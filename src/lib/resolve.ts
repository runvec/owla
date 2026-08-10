import { prisma } from "@/lib/prisma";

export type ResolutionOutcome = "YES" | "NO" | "VOID";

/**
 * Resolve um mercado fechado dentro do lock do mercado:
 *  1. cancela ordens em aberto (liberando caução de compras);
 *  2. paga 100 pts por cota vencedora, 0 pela perdedora, 50/50 no VOID
 *     (RESOLUTION_PAYOUT);
 *  3. zera posições e pairs.
 *
 * Como pairs == ΣYES == ΣNO em todo momento, o total pago é exatamente
 * 100 × pairs (colateral liberado) — o invariante global é preservado.
 * Dupla resolução é impossível: a transação valida status CLOSED.
 */
export async function resolveMarket(
  marketId: string,
  outcome: ResolutionOutcome,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT COUNT(*)::int AS "acquired" FROM (SELECT pg_advisory_xact_lock(hashtext(${marketId})::bigint)) AS t`;

    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw new Error("Mercado não encontrado");
    if (
      market.status === "RESOLVED_YES" ||
      market.status === "RESOLVED_NO" ||
      market.status === "VOID"
    ) {
      throw new Error("Mercado já resolvido");
    }
    if (market.status !== "CLOSED") {
      throw new Error("Feche o mercado antes de resolver");
    }

    // 1. Cancela ordens em aberto (libera caução das compras).
    const openOrders = await tx.order.findMany({
      where: { marketId, status: { in: ["OPEN", "PARTIAL"] } },
    });
    for (const order of openOrders) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELED" },
      });
      if (order.direction === "BUY") {
        const rest = order.qty - order.filledQty;
        if (rest > 0) {
          const released = order.priceCents * rest;
          await tx.user.update({
            where: { id: order.userId },
            data: {
              balance: { increment: released },
              escrow: { decrement: released },
            },
          });
          await tx.pointsTransaction.create({
            data: { userId: order.userId, amount: 0, type: "ORDER_RELEASE", refId: order.id },
          });
        }
      }
    }

    // 2. Pagamentos por cota.
    const positions = await tx.position.findMany({ where: { marketId, qty: { gt: 0 } } });
    const perShare = (side: "YES" | "NO") => {
      if (outcome === "VOID") return 50;
      return side === outcome ? 100 : 0;
    };
    for (const pos of positions) {
      const payout = perShare(pos.side) * pos.qty;
      if (payout > 0) {
        await tx.user.update({
          where: { id: pos.userId },
          data: { balance: { increment: payout } },
        });
        await tx.pointsTransaction.create({
          data: {
            userId: pos.userId,
            amount: payout,
            type: "RESOLUTION_PAYOUT",
            refId: marketId,
          },
        });
      }
      await tx.position.delete({ where: { id: pos.id } });
    }

    // 3. Fecha o mercado.
    const finalStatus = outcome === "YES" ? "RESOLVED_YES" : outcome === "NO" ? "RESOLVED_NO" : "VOID";
    await tx.market.update({
      where: { id: marketId },
      data: { status: finalStatus, pairs: 0 },
    });
  });
}

/** Fecha um mercado para negociação (pré-requisito da resolução). */
export async function closeMarket(marketId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT COUNT(*)::int AS "acquired" FROM (SELECT pg_advisory_xact_lock(hashtext(${marketId})::bigint)) AS t`;
    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw new Error("Mercado não encontrado");
    if (market.status === "CLOSED") return;
    if (market.status !== "OPEN") throw new Error("Mercado não está aberto");
    await tx.market.update({ where: { id: marketId }, data: { status: "CLOSED" } });
  });
}

/** Reabre um mercado fechado (correção administrativa). */
export async function reopenMarket(marketId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT COUNT(*)::int AS "acquired" FROM (SELECT pg_advisory_xact_lock(hashtext(${marketId})::bigint)) AS t`;
    const market = await tx.market.findUnique({ where: { id: marketId } });
    if (!market) throw new Error("Mercado não encontrado");
    if (market.status !== "CLOSED") throw new Error("Mercado não está fechado");
    await tx.market.update({ where: { id: marketId }, data: { status: "OPEN" } });
  });
}

