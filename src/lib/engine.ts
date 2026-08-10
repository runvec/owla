import { Prisma } from "@/generated/prisma/client";
import type { OrderSide, OrderDirection, OrderType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Motor de casamento de ordens (CLOB) — ver docs/ENGINE.md.
 *
 * Toda ordem é normalizada em uma "compra" de um token a um preço:
 *   BUY  YES @ p  -> comprar YES @ p
 *   SELL YES @ p  -> comprar NO  @ (100 - p)
 *   BUY  NO  @ p  -> comprar NO  @ p
 *   SELL NO  @ p  -> comprar YES @ (100 - p)
 *
 * Um taker que compra o token X casa com um maker que compra o token oposto
 * quando preço_taker + preço_maker >= 100. O maker mantém o seu preço; o
 * taker paga o complemento (100 - preço_maker). Prioridade preço-tempo.
 *
 * Cruzamentos: BUY x BUY = MINT (+pares), SELL x SELL = MERGE (-pares),
 * misto = TRANSFER (pares inalterados). Conservação: ver prova no ENGINE.md.
 *
 * Concorrência: cada operação roda em UMA transação que adquire
 * pg_advisory_xact_lock(hashtext(marketId)) — um único escritor por mercado.
 */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface NewOrderInput {
  marketId: string;
  side: OrderSide;
  direction: OrderDirection;
  priceCents: number; // 1..99
  qty: number;
  type: OrderType; // GTC | FAK
}

export interface TradeResult {
  priceCents: number; // preço do lado YES (para gráfico/lastPrice)
  qty: number;
  kind: "MINT" | "MERGE" | "TRANSFER";
}

export interface PlaceOrderResult {
  orderId: string;
  filledQty: number;
  remainingQty: number;
  status: "FILLED" | "PARTIAL" | "OPEN" | "CANCELED";
  trades: TradeResult[];
  averagePriceCents: number | null;
}

interface Normalized {
  token: "YES" | "NO";
  price: number;
  realBuy: boolean;
}

function normalize(
  side: OrderSide,
  direction: OrderDirection,
  priceCents: number,
): Normalized {
  if (direction === "BUY") {
    return { token: side, price: priceCents, realBuy: true };
  }
  return { token: side === "YES" ? "NO" : "YES", price: 100 - priceCents, realBuy: false };
}

function isValidPrice(priceCents: number): boolean {
  return Number.isInteger(priceCents) && priceCents >= 1 && priceCents <= 99;
}

/** Trava de escritor único por mercado (deve ser chamado dentro da transação). */
async function acquireMarketLock(tx: Tx, marketId: string): Promise<void> {
  // O wrapper COUNT evita a coluna "void" que o Prisma 7/adapter-pg não desserializa.
  await tx.$queryRaw`SELECT COUNT(*)::int AS "acquired" FROM (SELECT pg_advisory_xact_lock(hashtext(${marketId})::bigint)) AS t;`;
}

/** Atualiza a posição de um participante e grava o movimento no ledger. */
async function applyFillToPosition(
  tx: Tx,
  participant: { userId: string; side: OrderSide },
  fill: { q: number; cost: number; realBuy: boolean },
  tradeId: string,
): Promise<void> {
  const { userId } = participant;
  const { q, cost, realBuy } = fill;

  if (realBuy) {
    // paga cost por cota (escrow) e ganha a cota
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: -cost * q,
        type: "TRADE_SETTLE",
        refId: tradeId,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { escrow: { decrement: cost * q } },
    });
  } else {
    // recebe (100 - cost) por cota e entrega a cota
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: (100 - cost) * q,
        type: "TRADE_SETTLE",
        refId: tradeId,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: (100 - cost) * q } },
    });
  }
}

/**
 * Posições: leitura + atualização atômica dentro da mesma transação.
 * A posição é identificada por (userId, marketId, side) via chave composta.
 */
async function applyPosition(
  tx: Tx,
  userId: string,
  marketId: string,
  side: OrderSide,
  dqty: number,
  cost: number,
  realBuy: boolean,
): Promise<void> {
  const existing = await tx.position.findUnique({
    where: { userId_marketId_side: { userId, marketId, side } },
  });
  const prevQty = existing?.qty ?? 0;
  const prevAvg = existing?.avgCostCents ?? 0;

  if (realBuy) {
    const newQty = prevQty + dqty;
    const newAvg = prevQty > 0 ? Math.round((prevQty * prevAvg + dqty * cost) / newQty) : cost;
    await tx.position.upsert({
      where: { userId_marketId_side: { userId, marketId, side } },
      create: { userId, marketId, side, qty: newQty, avgCostCents: newAvg },
      update: { qty: newQty, avgCostCents: newAvg },
    });
  } else {
    const newQty = prevQty - dqty;
    if (newQty < 0) {
      throw new Error("Saldo insuficiente de cotas para vender");
    }
    const newAvg = newQty > 0 ? prevAvg : 0;
    await tx.position.upsert({
      where: { userId_marketId_side: { userId, marketId, side } },
      create: { userId, marketId, side, qty: newQty, avgCostCents: newAvg },
      update: { qty: newQty, avgCostCents: newAvg },
    });
  }
}

/** Cotas reservadas por vendas em aberto (valida venda sem cobrir a posição). */
async function openSellReserved(tx: Tx, userId: string, marketId: string, side: OrderSide): Promise<number> {
  const agg = await tx.order.aggregate({
    where: {
      userId,
      marketId,
      side,
      direction: "SELL",
      status: { in: ["OPEN", "PARTIAL"] },
    },
    _sum: { qty: true, filledQty: true },
  });
  return (agg._sum.qty ?? 0) - (agg._sum.filledQty ?? 0);
}

/**
 * Coloca uma ordem (limite GTC ou marketável FAK) no mercado e executa o
 * casamento dentro do lock do mercado.
 */
export async function placeOrder(
  userId: string,
  input: NewOrderInput,
): Promise<PlaceOrderResult> {
  const { marketId, side, direction, priceCents, qty, type } = input;

  if (!isValidPrice(priceCents)) {
    throw new Error("Preço deve ser um inteiro entre 1 e 99");
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error("Quantidade deve ser um inteiro positivo");
  }

  const norm = normalize(side, direction, priceCents);

  return prisma.$transaction(async (tx) => {
    await acquireMarketLock(tx, marketId);

    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw new Error("Mercado não encontrado");
    if (market.status !== "OPEN") throw new Error("Mercado não está aberto para negociação");

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    // Caução ou validação de cotas antes de qualquer execução.
    if (direction === "BUY") {
      const escrowNeeded = priceCents * qty;
      if (user.balance < escrowNeeded) {
        throw new Error("Pontos insuficientes para a compra");
      }
    } else {
      const reserved = await openSellReserved(tx, userId, marketId, side);
      const position = await tx.position.findUnique({
        where: { userId_marketId_side: { userId, marketId, side } },
      });
      const held = position?.qty ?? 0;
      if (held - reserved < qty) {
        throw new Error("Cotas insuficientes para vender");
      }
    }

    // Cria a ordem (status provisório; finalizado após o loop de casamento).
    const order = await tx.order.create({
      data: {
        userId,
        marketId,
        side,
        direction,
        priceCents,
        qty,
        type,
        status: "OPEN",
      },
    });

    if (direction === "BUY") {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { decrement: priceCents * qty },
          escrow: { increment: priceCents * qty },
        },
      });
      await tx.pointsTransaction.create({
        data: { userId, amount: 0, type: "ORDER_ESCROW", refId: order.id },
      });
    }

    const trades: TradeResult[] = [];
    let remaining = qty;
    let filled = 0;
    let totalCost = 0;

    while (remaining > 0) {
      // Makers do token oposto: normalizados com preço >= 100 - preço do taker.
      // A prioridade preço-tempo é resolvida no SQL (ordenar por preço normalizado
      // desc, depois o mais antigo) ANTES do corte — ordenar apenas após o LIMIT
      // ignoraria makers de melhor preço além do lote. O loop re-consulta a cada
      // iteração, então o lote de 200 é só tamanho de batch: o book inteiro é
      // consumido na ordem correta.
      const opposite = norm.token === "YES" ? "NO" : "YES";
      const makerCandidates = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          side: "YES" | "NO";
          direction: "BUY" | "SELL";
          priceCents: number;
          qty: number;
          filledQty: number;
          createdAt: Date;
        }>
      >`
        SELECT id, "userId", side, direction, "priceCents", qty, "filledQty", "createdAt"
        FROM "Order"
        WHERE
          "marketId" = ${marketId}
          AND status IN ('OPEN', 'PARTIAL')
          AND "userId" <> ${userId}
          AND (
            ${
              norm.token === "YES"
                ? Prisma.sql`(side = 'NO' AND direction = 'BUY' AND "priceCents" >= ${100 - norm.price})
              OR (side = 'YES' AND direction = 'SELL' AND "priceCents" <= ${norm.price})`
                : Prisma.sql`(side = 'YES' AND direction = 'BUY' AND "priceCents" >= ${100 - norm.price})
              OR (side = 'NO' AND direction = 'SELL' AND "priceCents" <= ${norm.price})`
            }
          )
        ORDER BY
          (CASE WHEN direction = 'BUY' THEN "priceCents" ELSE 100 - "priceCents" END) DESC,
          "createdAt" ASC
        LIMIT 200
      `;

      // Salvaguarda: garante que só makers do token oposto entram no casamento.
      const makers = makerCandidates
        .map((m) => {
          const mn = normalize(m.side, m.direction, m.priceCents);
          return { ...m, mn };
        })
        .filter((m) => m.mn.token === opposite);

      if (makers.length === 0) break;

      let crossed = false;
      for (const maker of makers) {
        if (remaining <= 0) break;
        const avail = maker.qty - maker.filledQty;
        const q = Math.min(remaining, avail);
        if (q <= 0) continue;

        crossed = true;
        const makerPrice = maker.mn.price; // maker mantém o preço
        const takerCost = 100 - makerPrice; // taker paga o complemento

        const kind: "MINT" | "MERGE" | "TRANSFER" =
          norm.realBuy && maker.mn.realBuy
            ? "MINT"
            : !norm.realBuy && !maker.mn.realBuy
              ? "MERGE"
              : "TRANSFER";

        // Preço do lado YES para o gráfico/lastPrice.
        const yesSideIsTaker = side === "YES";
        const pYes = yesSideIsTaker
          ? norm.realBuy
            ? takerCost
            : 100 - takerCost
          : maker.mn.realBuy
            ? makerPrice
            : 100 - makerPrice;

        const trade = await tx.trade.create({
          data: {
            marketId,
            priceCents: pYes,
            qty: q,
            takerId: userId,
            makerId: maker.userId,
            kind,
          },
        });

        // Ledger + posições do taker.
        await applyPosition(tx, userId, marketId, side, q, takerCost, norm.realBuy);
        await applyFillToPosition(
          tx,
          { userId, side },
          { q, cost: takerCost, realBuy: norm.realBuy },
          trade.id,
        );

        // Ledger + posições do maker.
        await applyPosition(tx, maker.userId, marketId, maker.side, q, makerPrice, maker.mn.realBuy);
        await applyFillToPosition(
          tx,
          { userId: maker.userId, side: maker.side },
          { q, cost: makerPrice, realBuy: maker.mn.realBuy },
          trade.id,
        );

        // Atualiza o maker no livro.
        const newFilled = maker.filledQty + q;
        await tx.order.update({
          where: { id: maker.id },
          data: {
            filledQty: newFilled,
            status: newFilled >= maker.qty ? "FILLED" : "PARTIAL",
          },
        });

        // Estado do mercado.
        const pairsDelta = kind === "MINT" ? q : kind === "MERGE" ? -q : 0;
        await tx.market.update({
          where: { id: marketId },
          data: {
            lastPrice: pYes,
            volume: { increment: pYes * q },
            pairs: { increment: pairsDelta },
          },
        });
        await tx.pricePoint.create({
          data: { marketId, priceCents: pYes },
        });

        trades.push({ priceCents: pYes, qty: q, kind });
        filled += q;
        totalCost += takerCost * q;
        remaining -= q;
      }

      if (!crossed) break; // segurança: nenhum maker cruzável encontrado
    }

    // Finaliza a ordem (FAK não descansa; GTC descansa com caução).
    let status: PlaceOrderResult["status"];
    if (remaining === 0) {
      status = "FILLED";
    } else if (type === "FAK") {
      status = "CANCELED";
    } else {
      status = filled > 0 ? "PARTIAL" : "OPEN";
    }
    await tx.order.update({
      where: { id: order.id },
      data: { filledQty: filled, status },
    });

    // Libera a sobra do escrow de compras (GTC: mantém caução da parte em aberto).
    if (direction === "BUY" && remaining > 0) {
      const restingQty = type === "GTC" ? remaining : 0;
      const currentEscrow = priceCents * qty - totalCost;
      const released = currentEscrow - priceCents * restingQty;
      if (released > 0) {
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { increment: released },
            escrow: { decrement: released },
          },
        });
        await tx.pointsTransaction.create({
          data: { userId, amount: 0, type: "ORDER_RELEASE", refId: order.id },
        });
      }
    }

    const averagePriceCents = filled > 0 ? Math.round(totalCost / filled) : null;
    return { orderId: order.id, filledQty: filled, remainingQty: remaining, status, trades, averagePriceCents };
  });
}

/**
 * Cancela uma ordem própria em aberto (libera a caução de compra).
 */
export async function cancelOrder(orderId: string, userId: string): Promise<void> {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new Error("Ordem não encontrada");
  if (existing.userId !== userId) throw new Error("Não é possível cancelar a ordem de outro usuário");

  await prisma.$transaction(async (tx) => {
    await acquireMarketLock(tx, existing.marketId);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order || order.status === "CANCELED" || order.status === "FILLED") return;
    if (order.status !== "OPEN" && order.status !== "PARTIAL") return;

    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });

    if (order.direction === "BUY") {
      const rest = order.qty - order.filledQty;
      if (rest > 0) {
        const released = order.priceCents * rest;
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: { increment: released },
            escrow: { decrement: released },
          },
        });
        await tx.pointsTransaction.create({
          data: { userId, amount: 0, type: "ORDER_RELEASE", refId: order.id },
        });
      }
    }
  });
}