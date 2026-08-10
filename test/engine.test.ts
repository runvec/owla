import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { cancelOrder, placeOrder } from "@/lib/engine";
import { claimDailyBonus, DAILY_BONUS } from "@/lib/points";
import { closeMarket, resolveMarket } from "@/lib/resolve";
import { hashPassword } from "@/lib/password";
import type { OrderDirection, OrderSide, OrderType } from "@/generated/prisma/client";

const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let seqCounter = 0;
const seq = () => `${RUN}-${++seqCounter}`;

const createdUsers: string[] = [];
const createdEvents: string[] = [];
const createdMarkets: string[] = [];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function createUser(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `engine-test-${seq()}@test.local`,
      passwordHash: await hashPassword("teste123"),
      name: `EngineTest-${seq()}`,
      role: "USER",
    },
  });
  createdUsers.push(user.id);
  return user.id;
}

async function fundUser(userId: string, amount: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amount }, totalGranted: { increment: amount } },
    });
    await tx.pointsTransaction.create({
      data: { userId, amount, type: "ADMIN_ADJUST", refId: `test-fund-${seq()}` },
    });
  });
}

const fund = (userId: string) => fundUser(userId, 1_000_000);

async function createMarket(): Promise<string> {
  const event = await prisma.event.create({
    data: {
      slug: `ev-${seq()}`,
      title: `Evento ${seq()}`,
      description: "evento de teste do motor",
      category: "Teste",
      status: "OPEN",
      endsAt: new Date(Date.now() + 90 * 86_400_000),
    },
  });
  createdEvents.push(event.id);
  const market = await prisma.market.create({
    data: {
      eventId: event.id,
      question: `Questão ${seq()}`,
      status: "OPEN",
      lastPrice: 50,
      volume: 0,
      pairs: 0,
    },
  });
  createdMarkets.push(market.id);
  return market.id;
}

interface Spec {
  side: OrderSide;
  direction: OrderDirection;
  priceCents: number;
  qty: number;
  type: OrderType;
}

const place = (userId: string, marketId: string, spec: Spec) =>
  placeOrder(userId, { marketId, ...spec });

async function assertUserLedger(userId: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const agg = await prisma.pointsTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  expect(user.balance + user.escrow).toBe(agg._sum.amount ?? 0);
}

async function assertMarketBalanced(marketId: string): Promise<void> {
  const market = await prisma.market.findUniqueOrThrow({ where: { id: marketId } });
  const yes = await prisma.position.aggregate({
    where: { marketId, side: "YES" },
    _sum: { qty: true },
  });
  const no = await prisma.position.aggregate({
    where: { marketId, side: "NO" },
    _sum: { qty: true },
  });
  expect(yes._sum.qty ?? 0).toBe(market.pairs);
  expect(no._sum.qty ?? 0).toBe(market.pairs);
}

async function assertGlobalInvariants(): Promise<void> {
  const users = await prisma.user.aggregate({
    _sum: { balance: true, escrow: true, totalGranted: true },
  });
  const markets = await prisma.market.aggregate({ _sum: { pairs: true } });
  const lhs =
    (users._sum.balance ?? 0) + (users._sum.escrow ?? 0) + 100 * (markets._sum.pairs ?? 0);
  expect(lhs).toBe(users._sum.totalGranted ?? 0);

  const yes = await prisma.position.aggregate({ where: { side: "YES" }, _sum: { qty: true } });
  const no = await prisma.position.aggregate({ where: { side: "NO" }, _sum: { qty: true } });
  expect(yes._sum.qty ?? 0).toBe(markets._sum.pairs ?? 0);
  expect(no._sum.qty ?? 0).toBe(markets._sum.pairs ?? 0);

  const allUsers = await prisma.user.findMany({ select: { balance: true, escrow: true } });
  for (const u of allUsers) {
    expect(u.balance).toBeGreaterThanOrEqual(0);
    expect(u.escrow).toBeGreaterThanOrEqual(0);
  }
  const allPos = await prisma.position.findMany({ select: { qty: true } });
  for (const p of allPos) expect(p.qty).toBeGreaterThanOrEqual(0);
  const allMarkets = await prisma.market.findMany({ select: { pairs: true } });
  for (const m of allMarkets) expect(m.pairs).toBeGreaterThanOrEqual(0);
}

describe("engine", () => {
  it("(1) conservação global: Σ(balance+escrow) + 100×Σpairs == ΣtotalGranted após série de operações", async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    await Promise.all([fund(a), fund(b), fund(c)]);
    const m = await createMarket();

    await place(a, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 30, type: "GTC" });
    const t1 = await place(b, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 15, type: "FAK" });
    expect(t1.status).toBe("FILLED");
    const t2 = await place(c, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 15, type: "FAK" });
    expect(t2.trades).toHaveLength(1);
    await place(a, m, { side: "YES", direction: "BUY", priceCents: 40, qty: 8, type: "GTC" });

    await assertGlobalInvariants();
    await Promise.all([assertUserLedger(a), assertUserLedger(b), assertUserLedger(c)]);
    await assertMarketBalanced(m);
  });

  it("(2) por usuário: balance+escrow == Σ(pointsTransaction.amount)", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 10, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 10, type: "FAK" });
    await place(a, m, { side: "NO", direction: "BUY", priceCents: 60, qty: 5, type: "GTC" });
    await place(a, m, { side: "NO", direction: "BUY", priceCents: 40, qty: 3, type: "GTC" });
    const open = await prisma.order.findMany({
      where: { marketId: m, userId: a, status: { in: ["OPEN", "PARTIAL"] } },
    });
    for (const o of open) await cancelOrder(o.id, a);

    await assertUserLedger(a);
    await assertUserLedger(b);
  });

  it("(3) por mercado: pairs == ΣYES == ΣNO (MINT e MERGE)", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    const mint = await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    expect(mint.status).toBe("FILLED");
    expect(mint.trades[0].kind).toBe("MINT");
    await assertMarketBalanced(m);

    await place(a, m, { side: "NO", direction: "SELL", priceCents: 50, qty: 5, type: "GTC" });
    const merge = await place(b, m, { side: "YES", direction: "SELL", priceCents: 50, qty: 5, type: "FAK" });
    expect(merge.status).toBe("FILLED");
    expect(merge.trades[0].kind).toBe("MERGE");
    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.pairs).toBe(0);
    await assertMarketBalanced(m);
  });

  it("(4) não-negatividade: balance/escrow/qty/pairs >= 0 após cenário denso", async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    await Promise.all([fund(a), fund(b), fund(c)]);
    const m1 = await createMarket();
    const m2 = await createMarket();

    await place(a, m1, { side: "NO", direction: "BUY", priceCents: 50, qty: 10, type: "GTC" });
    await place(b, m1, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await place(b, m1, { side: "NO", direction: "BUY", priceCents: 50, qty: 15, type: "GTC" });
    await place(a, m1, { side: "YES", direction: "BUY", priceCents: 50, qty: 15, type: "FAK" });
    await place(c, m1, { side: "NO", direction: "BUY", priceCents: 50, qty: 8, type: "GTC" });
    await place(b, m2, { side: "YES", direction: "BUY", priceCents: 60, qty: 12, type: "GTC" });
    const res = await place(c, m2, { side: "NO", direction: "BUY", priceCents: 60, qty: 12, type: "FAK" });
    expect(res.status).toBe("FILLED");

    await assertGlobalInvariants();
    await Promise.all([assertMarketBalanced(m1), assertMarketBalanced(m2)]);
  });

  it("(5) prioridade preço-tempo: melhor preço preenche primeiro", async () => {
    const x = await createUser();
    const y = await createUser();
    const t = await createUser();
    await Promise.all([fund(x), fund(y), fund(t)]);
    const m = await createMarket();

    await place(x, m, { side: "NO", direction: "BUY", priceCents: 70, qty: 10, type: "GTC" });
    await sleep(10);
    await place(y, m, { side: "NO", direction: "BUY", priceCents: 60, qty: 10, type: "GTC" });

    const taker = await place(t, m, { side: "YES", direction: "BUY", priceCents: 60, qty: 20, type: "FAK" });
    expect(taker.status).toBe("FILLED");
    expect(taker.trades.map((tr) => tr.priceCents)).toEqual([30, 40]);

    const trades = await prisma.trade.findMany({
      where: { marketId: m },
      orderBy: { createdAt: "asc" },
    });
    expect(trades).toHaveLength(2);
    expect(trades[0].makerId).toBe(x);
    expect(trades[1].makerId).toBe(y);
    await assertMarketBalanced(m);
  });

  it("(6) prioridade preço-tempo: mesmo preço, mais antigo primeiro", async () => {
    const x = await createUser();
    const y = await createUser();
    const t = await createUser();
    await Promise.all([fund(x), fund(y), fund(t)]);
    const m = await createMarket();

    await place(x, m, { side: "NO", direction: "BUY", priceCents: 55, qty: 10, type: "GTC" });
    await sleep(10);
    await place(y, m, { side: "NO", direction: "BUY", priceCents: 55, qty: 10, type: "GTC" });

    const taker = await place(t, m, { side: "YES", direction: "BUY", priceCents: 55, qty: 20, type: "FAK" });
    expect(taker.status).toBe("FILLED");
    const trades = await prisma.trade.findMany({
      where: { marketId: m },
      orderBy: { createdAt: "asc" },
    });
    expect(trades[0].makerId).toBe(x);
    expect(trades[1].makerId).toBe(y);
  });

  it("(7) auto-negociação: ordem própria em aberto é pulada", async () => {
    const u = await createUser();
    await fund(u);
    const m = await createMarket();

    const own = await place(u, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 10, type: "GTC" });
    expect(own.status).toBe("OPEN");

    const taker = await place(u, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 10, type: "FAK" });
    expect(taker.status).toBe("CANCELED");
    expect(taker.filledQty).toBe(0);
    expect(taker.trades).toHaveLength(0);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: u } });
    expect(user.escrow).toBe(50 * 10);
    expect(user.balance).toBe(1_000_000 - 500);
    const open = await prisma.order.findUnique({ where: { id: own.orderId } });
    expect(open?.status).toBe("OPEN");
  });

  it("(8) FAK parcial: resto descartado e escrow devolvido", async () => {
    const maker = await createUser();
    const taker = await createUser();
    await Promise.all([fund(maker), fund(taker)]);
    const m = await createMarket();

    await place(maker, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    const res = await place(taker, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 10, type: "FAK" });
    expect(res.status).toBe("CANCELED");
    expect(res.filledQty).toBe(5);
    expect(res.remainingQty).toBe(5);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: taker } });
    expect(user.escrow).toBe(0);
    expect(user.balance).toBe(1_000_000 - 250);
    const order = await prisma.order.findUnique({ where: { id: res.orderId } });
    expect(order?.status).toBe("CANCELED");
    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.pairs).toBe(5);
    await assertUserLedger(taker);
  });

  it("(9) GTC parcial: resto permanece no book com escrow no restante", async () => {
    const maker = await createUser();
    const taker = await createUser();
    await Promise.all([fund(maker), fund(taker)]);
    const m = await createMarket();

    await place(maker, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    const res = await place(taker, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 10, type: "GTC" });
    expect(res.status).toBe("PARTIAL");
    expect(res.filledQty).toBe(5);
    expect(res.remainingQty).toBe(5);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: taker } });
    expect(user.escrow).toBe(50 * 5);
    expect(user.balance).toBe(1_000_000 - 50 * 10);
    const order = await prisma.order.findUnique({ where: { id: res.orderId } });
    expect(order?.status).toBe("PARTIAL");
    expect(order?.filledQty).toBe(5);
    await assertUserLedger(taker);
  });

  it("(10) cancelOrder devolve escrow integral; ordem alheia não pode ser cancelada", async () => {
    const u = await createUser();
    const v = await createUser();
    await Promise.all([fund(u), fund(v)]);
    const m = await createMarket();

    const o1 = await place(u, m, { side: "YES", direction: "BUY", priceCents: 30, qty: 10, type: "GTC" });
    const o2 = await place(u, m, { side: "NO", direction: "BUY", priceCents: 40, qty: 5, type: "GTC" });
    const other = await place(v, m, { side: "NO", direction: "BUY", priceCents: 40, qty: 5, type: "GTC" });

    let user = await prisma.user.findUniqueOrThrow({ where: { id: u } });
    expect(user.escrow).toBe(30 * 10 + 40 * 5);

    await expect(cancelOrder(other.orderId, u)).rejects.toThrow("outro usuário");

    await cancelOrder(o1.orderId, u);
    await cancelOrder(o2.orderId, u);

    user = await prisma.user.findUniqueOrThrow({ where: { id: u } });
    expect(user.escrow).toBe(0);
    expect(user.balance).toBe(1_000_000);
    const o1Db = await prisma.order.findUnique({ where: { id: o1.orderId } });
    const o2Db = await prisma.order.findUnique({ where: { id: o2.orderId } });
    expect(o1Db?.status).toBe("CANCELED");
    expect(o2Db?.status).toBe("CANCELED");
    await assertUserLedger(u);
  });

  it("(11) MINT: deltas de pairs, lastPrice e volume", async () => {
    const x = await createUser();
    const y = await createUser();
    await Promise.all([fund(x), fund(y)]);
    const m = await createMarket();

    await place(x, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 10, type: "GTC" });
    const res = await place(y, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 10, type: "FAK" });

    expect(res.trades).toHaveLength(1);
    expect(res.trades[0].kind).toBe("MINT");
    expect(res.trades[0].qty).toBe(10);
    expect(res.trades[0].priceCents).toBe(50);

    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.pairs).toBe(10);
    expect(market.lastPrice).toBe(50);
    expect(market.volume).toBe(500);
    const pp = await prisma.pricePoint.count({ where: { marketId: m } });
    expect(pp).toBe(1);
    await assertMarketBalanced(m);
  });

  it("(12) TRANSFER: pairs inalterados, posições transferidas", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    let market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.pairs).toBe(5);

    await place(a, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    const res = await place(b, m, { side: "YES", direction: "SELL", priceCents: 50, qty: 5, type: "FAK" });
    expect(res.status).toBe("FILLED");
    expect(res.trades[0].kind).toBe("TRANSFER");

    market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.pairs).toBe(5);
    const bYes = await prisma.position.findUnique({
      where: { userId_marketId_side: { userId: b, marketId: m, side: "YES" } },
    });
    expect(bYes?.qty ?? 0).toBe(0);
    await assertMarketBalanced(m);
  });

  it("(13) MERGE: pairs reduzidos e cotas queimadas", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await place(a, m, { side: "NO", direction: "SELL", priceCents: 50, qty: 5, type: "GTC" });
    const res = await place(b, m, { side: "YES", direction: "SELL", priceCents: 50, qty: 5, type: "FAK" });

    expect(res.status).toBe("FILLED");
    expect(res.trades[0].kind).toBe("MERGE");
    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.pairs).toBe(0);
    await assertMarketBalanced(m);
    await Promise.all([assertUserLedger(a), assertUserLedger(b)]);
  });

  it("(14) resolução YES paga 100/cota ao lado vencedor", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await closeMarket(m);
    await resolveMarket(m, "YES");

    const aDb = await prisma.user.findUniqueOrThrow({ where: { id: a } });
    const bDb = await prisma.user.findUniqueOrThrow({ where: { id: b } });
    expect(aDb.balance).toBe(1_000_000 - 250);
    expect(bDb.balance).toBe(1_000_000 - 250 + 500);
    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.status).toBe("RESOLVED_YES");
    expect(market.pairs).toBe(0);
    expect(await prisma.position.count({ where: { marketId: m } })).toBe(0);
    expect(
      await prisma.pointsTransaction.count({ where: { userId: b, type: "RESOLUTION_PAYOUT" } }),
    ).toBe(1);
    await Promise.all([assertUserLedger(a), assertUserLedger(b)]);
    await assertGlobalInvariants();
  });

  it("(15) resolução NO paga 100/cota ao lado NO", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await closeMarket(m);
    await resolveMarket(m, "NO");

    const aDb = await prisma.user.findUniqueOrThrow({ where: { id: a } });
    const bDb = await prisma.user.findUniqueOrThrow({ where: { id: b } });
    expect(aDb.balance).toBe(1_000_000 - 250 + 500);
    expect(bDb.balance).toBe(1_000_000 - 250);
    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.status).toBe("RESOLVED_NO");
    await assertGlobalInvariants();
  });

  it("(16) resolução VOID paga 50/50", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await closeMarket(m);
    await resolveMarket(m, "VOID");

    const aDb = await prisma.user.findUniqueOrThrow({ where: { id: a } });
    const bDb = await prisma.user.findUniqueOrThrow({ where: { id: b } });
    expect(aDb.balance).toBe(1_000_000 - 250 + 250);
    expect(bDb.balance).toBe(1_000_000 - 250 + 250);
    const market = await prisma.market.findUniqueOrThrow({ where: { id: m } });
    expect(market.status).toBe("VOID");
    await assertGlobalInvariants();
  });

  it("(17) dupla resolução é rejeitada", async () => {
    const a = await createUser();
    const b = await createUser();
    await Promise.all([fund(a), fund(b)]);
    const m = await createMarket();

    await place(a, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(b, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await closeMarket(m);
    await resolveMarket(m, "YES");
    await expect(resolveMarket(m, "YES")).rejects.toThrow("já resolvido");
  });

  it("(18) resolver mercado OPEN é rejeitado (feche antes)", async () => {
    const m = await createMarket();
    await expect(resolveMarket(m, "YES")).rejects.toThrow("Feche o mercado antes de resolver");
  });

  it("(19) mercado fechado rejeita novas ordens", async () => {
    const u = await createUser();
    await fund(u);
    const m = await createMarket();
    await closeMarket(m);
    await expect(
      place(u, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 1, type: "GTC" }),
    ).rejects.toThrow("não está aberto");
    await expect(
      place(u, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 1, type: "FAK" }),
    ).rejects.toThrow("não está aberto");
  });

  it("(20) compra sem saldo é rejeitada", async () => {
    const u = await createUser();
    const m = await createMarket();
    await expect(
      place(u, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 1, type: "GTC" }),
    ).rejects.toThrow("Pontos insuficientes");
  });

  it("(21) venda sem posição (ou acima dela) é rejeitada", async () => {
    const u = await createUser();
    const v = await createUser();
    await Promise.all([fund(u), fund(v)]);
    const m = await createMarket();

    await expect(
      place(u, m, { side: "YES", direction: "SELL", priceCents: 50, qty: 1, type: "GTC" }),
    ).rejects.toThrow("Cotas insuficientes");

    await place(u, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 5, type: "GTC" });
    await place(v, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 5, type: "FAK" });
    await expect(
      place(v, m, { side: "YES", direction: "SELL", priceCents: 50, qty: 6, type: "FAK" }),
    ).rejects.toThrow("Cotas insuficientes");
  });

  it("(22) preço e quantidade inválidos são rejeitados", async () => {
    const u = await createUser();
    await fund(u);
    const m = await createMarket();

    for (const priceCents of [0, 100, 50.5, -3]) {
      await expect(
        place(u, m, { side: "YES", direction: "BUY", priceCents, qty: 1, type: "GTC" }),
      ).rejects.toThrow("Preço");
    }
    for (const qty of [0, -1, 1.5]) {
      await expect(
        place(u, m, { side: "YES", direction: "BUY", priceCents: 50, qty, type: "GTC" }),
      ).rejects.toThrow("Quantidade");
    }
  });

  it("(23) concorrência: 20 ordens simultâneas no mesmo mercado não corrompem estado", async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const u3 = await createUser();
    const v = await createUser();
    await Promise.all([fund(u1), fund(u2), fund(u3), fund(v)]);
    const m = await createMarket();

    await place(v, m, { side: "YES", direction: "BUY", priceCents: 50, qty: 40, type: "GTC" });
    await place(v, m, { side: "NO", direction: "BUY", priceCents: 50, qty: 40, type: "GTC" });

    const cycle = [u1, u2, u3];
    const specs: Array<Spec & { user: string }> = [];
    for (let i = 0; i < 7; i++) {
      specs.push({ user: cycle[i % 3], side: "YES", direction: "BUY", priceCents: 50, qty: 4, type: "FAK" });
    }
    for (let i = 0; i < 7; i++) {
      specs.push({ user: cycle[i % 3], side: "NO", direction: "BUY", priceCents: 50, qty: 4, type: "FAK" });
    }
    for (let i = 0; i < 3; i++) {
      specs.push({ user: cycle[i % 3], side: "YES", direction: "BUY", priceCents: 40, qty: 4, type: "GTC" });
    }
    for (let i = 0; i < 3; i++) {
      specs.push({ user: cycle[i % 3], side: "NO", direction: "BUY", priceCents: 40, qty: 4, type: "GTC" });
    }
    expect(specs).toHaveLength(20);

    const results = await Promise.allSettled(
      specs.map((s) => place(s.user, m, { side: s.side, direction: s.direction, priceCents: s.priceCents, qty: s.qty, type: s.type })),
    );
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(0);

    await assertGlobalInvariants();
    await assertMarketBalanced(m);
    for (const uid of [u1, u2, u3, v]) await assertUserLedger(uid);
  });

  it("(24) bônus concorrente: apenas 1 reivindicação real vence", async () => {
    const fresh = await createUser();
    const claimed = await createUser();
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await prisma.user.update({ where: { id: claimed }, data: { lastBonusAt: dayStart } });

    const results = await Promise.all([
      claimDailyBonus(fresh),
      claimDailyBonus(claimed),
      claimDailyBonus(claimed),
      claimDailyBonus(claimed),
      claimDailyBonus(claimed),
    ]);

    const wins = results.filter((r) => r.claimed);
    expect(wins).toHaveLength(1);
    expect(wins[0].amount).toBe(DAILY_BONUS);
    expect(
      await prisma.pointsTransaction.count({ where: { userId: fresh, type: "DAILY_BONUS" } }),
    ).toBe(1);
    expect(
      await prisma.pointsTransaction.count({ where: { userId: claimed, type: "DAILY_BONUS" } }),
    ).toBe(0);
    await assertUserLedger(fresh);
    await assertUserLedger(claimed);
    await assertGlobalInvariants();
  });

  it("(25) regressão: 210 makers com a MELHOR oferta criada por último — taker casa pelo melhor preço (fix prioridade preço-tempo)", async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    await Promise.all([fund(a), fund(b), fund(c)]);
    const m = await createMarket();

    await place(c, m, { side: "NO", direction: "BUY", priceCents: 51, qty: 210, type: "GTC" });
    const mint = await place(b, m, { side: "YES", direction: "BUY", priceCents: 49, qty: 210, type: "FAK" });
    expect(mint.status).toBe("FILLED");
    expect(mint.filledQty).toBe(210);

    for (let p = 99; p >= 90; p--) {
      for (let i = 0; i < 21; i++) {
        await place(b, m, { side: "YES", direction: "SELL", priceCents: p, qty: 1, type: "GTC" });
        await sleep(5);
      }
    }

    const result = await place(a, m, { side: "YES", direction: "BUY", priceCents: 99, qty: 210, type: "FAK" });
    expect(result.status).toBe("FILLED");
    expect(result.filledQty).toBe(210);
    expect(result.trades).toHaveLength(210);
    expect(result.trades[0].priceCents).toBe(90);
    expect(result.trades[209].priceCents).toBe(99);
    for (let i = 1; i < result.trades.length; i++) {
      expect(result.trades[i].priceCents).toBeGreaterThanOrEqual(result.trades[i - 1].priceCents);
    }
    const total = result.trades.reduce((s, t) => s + t.priceCents, 0);
    expect(total).toBe(21 * (90 + 91 + 92 + 93 + 94 + 95 + 96 + 97 + 98 + 99));
    expect(total).toBe(19845);
    expect(result.averagePriceCents).toBe(95);

    await assertGlobalInvariants();
    await assertMarketBalanced(m);
    await Promise.all([assertUserLedger(a), assertUserLedger(b), assertUserLedger(c)]);
  });
});

afterAll(async () => {
  await prisma.pricePoint.deleteMany({ where: { marketId: { in: createdMarkets } } });
  await prisma.trade.deleteMany({ where: { marketId: { in: createdMarkets } } });
  await prisma.order.deleteMany({ where: { marketId: { in: createdMarkets } } });
  await prisma.position.deleteMany({ where: { marketId: { in: createdMarkets } } });
  await prisma.pointsTransaction.deleteMany({ where: { userId: { in: createdUsers } } });
  await prisma.market.deleteMany({ where: { id: { in: createdMarkets } } });
  await prisma.event.deleteMany({ where: { id: { in: createdEvents } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
  await prisma.$disconnect();
});