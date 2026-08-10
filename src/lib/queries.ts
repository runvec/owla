import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserLevel } from "@/lib/points";

/**
 * Leituras de domínio: feed, evento, mercado, livro, carteira, ranking,
 * histórico, gráfico, comentários e propostas. Nada aqui grava estado.
 */

export type FeedSort = "trending" | "ending" | "new";

export interface MarketSummary {
  id: string;
  question: string;
  status: string;
  lastPrice: number;
  volume: number;
}

export interface EventFeedItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  endsAt: Date;
  createdAt: Date;
  status: string;
  price: number | null;
  totalVolume: number;
  markets: MarketSummary[];
}

export async function getEventFeed(params?: {
  category?: string;
  search?: string;
  sort?: FeedSort;
}): Promise<EventFeedItem[]> {
  const { category, search, sort = "trending" } = params ?? {};

  const where: Prisma.EventWhereInput = {}
  if (category && category !== "todas") where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      markets: {
        where: { status: { in: ["OPEN", "CLOSED"] } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let items: EventFeedItem[] = events.map((e) => {
    const openMarkets = e.markets.filter((m) => m.status === "OPEN");
    const main = openMarkets[0] ?? e.markets[0] ?? null;
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description,
      category: e.category,
      imageUrl: e.imageUrl,
      endsAt: e.endsAt,
      createdAt: e.createdAt,
      status: e.status,
      price: main ? main.lastPrice : null,
      totalVolume: e.markets.reduce((acc, m) => acc + m.volume, 0),
      markets: e.markets.map((m) => ({
        id: m.id,
        question: m.question,
        status: m.status,
        lastPrice: m.lastPrice,
        volume: m.volume,
      })),
    };
  });

  switch (sort) {
    case "trending":
      items = items.sort((a, b) => b.totalVolume - a.totalVolume);
      break;
    case "ending":
      items = items.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
      break;
    case "new":
      items = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
  }
  return items;
}

export async function getCategories(): Promise<string[]> {
  const rows = await prisma.event.findMany({
    select: { category: true },
    distinct: ["category"],
  });
  return rows.map((r) => r.category).sort();
}

export async function getEventDetail(slug: string) {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      markets: { orderBy: { createdAt: "asc" } },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!event) return null;
  return event;
}

export async function getMarketWithEvent(marketId: string) {
  return prisma.market.findUnique({
    where: { id: marketId },
    include: { event: true },
  });
}

export interface BookLine {
  priceCents: number;
  qty: number;
}

export async function getOrderBook(marketId: string): Promise<{ bids: BookLine[]; asks: BookLine[] }> {
  const rows = await prisma.order.findMany({
    where: { marketId, status: { in: ["OPEN", "PARTIAL"] } },
    select: { side: true, direction: true, priceCents: true, qty: true, filledQty: true },
  });

  const bids = new Map<number, number>(); // preço (lado YES) -> qty
  const asks = new Map<number, number>();

  for (const r of rows) {
    const rest = r.qty - r.filledQty;
    if (rest <= 0) continue;
    if (r.side === "YES" && r.direction === "BUY") add(bids, r.priceCents, rest);
    if (r.side === "NO" && r.direction === "SELL") add(bids, 100 - r.priceCents, rest);
    if (r.side === "YES" && r.direction === "SELL") add(asks, r.priceCents, rest);
    if (r.side === "NO" && r.direction === "BUY") add(asks, 100 - r.priceCents, rest);
  }

  const toLines = (m: Map<number, number>, desc: boolean) =>
    Array.from(m.entries())
      .map(([priceCents, qty]) => ({ priceCents, qty }))
      .sort((a, b) => (desc ? b.priceCents - a.priceCents : a.priceCents - b.priceCents));

  return { bids: toLines(bids, true), asks: toLines(asks, false) };
}

function add(m: Map<number, number>, priceCents: number, qty: number) {
  m.set(priceCents, (m.get(priceCents) ?? 0) + qty);
}

export async function getRecentTrades(marketId: string, limit = 40) {
  return prisma.trade.findMany({
    where: { marketId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      priceCents: true,
      qty: true,
      kind: true,
      createdAt: true,
      taker: { select: { name: true } },
    },
  });
}

export async function getUserSummary(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, balance: true, escrow: true, totalGranted: true },
  });
  const positions = await prisma.position.findMany({
    where: { userId, qty: { gt: 0 } },
    include: { market: true },
  });
  const posValue = positions.reduce((acc, p) => acc + p.qty * p.market.lastPrice, 0);
  const netWorth = user.balance + user.escrow + posValue;
  const profit = netWorth - user.totalGranted;
  return { ...user, netWorth, profit, positionValue: posValue, positions: positions.length };
}

export interface PositionRow {
  marketId: string;
  side: "YES" | "NO";
  qty: number;
  avgCostCents: number;
  lastPrice: number;
  unrealized: number;
  question: string;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  marketStatus: string;
}

export async function getPositions(userId: string): Promise<PositionRow[]> {
  const positions = await prisma.position.findMany({
    where: { userId, qty: { gt: 0 } },
    include: {
      market: { include: { event: true } },
    },
  });
  return positions.map((p) => ({
    marketId: p.marketId,
    side: p.side,
    qty: p.qty,
    avgCostCents: p.avgCostCents,
    lastPrice: p.market.lastPrice,
    unrealized: p.qty * (p.market.lastPrice - p.avgCostCents),
    question: p.market.question,
    eventId: p.market.event.id,
    eventTitle: p.market.event.title,
    eventSlug: p.market.event.slug,
    marketStatus: p.market.status,
  }));
}

export async function getHistory(userId: string, limit = 100) {
  return prisma.pointsTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
}

export interface LeaderboardRow {
  id: string;
  name: string;
  profit: number;
  volume: number;
}

export async function getLeaderboard(range: "all" | "week"): Promise<LeaderboardRow[]> {
  const weekStart = range === "week" ? new Date(Date.now() - 7 * 24 * 3600 * 1000) : null;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, balance: true, escrow: true, totalGranted: true },
  });

  const volumeByUser = new Map<string, number>();
  const trades = await prisma.trade.findMany({
    where: weekStart ? { createdAt: { gte: weekStart } } : {},
    select: { takerId: true, makerId: true, priceCents: true, qty: true },
  });
  for (const t of trades) {
    const v = t.priceCents * t.qty;
    volumeByUser.set(t.takerId, (volumeByUser.get(t.takerId) ?? 0) + v);
    volumeByUser.set(t.makerId, (volumeByUser.get(t.makerId) ?? 0) + v);
  }

  let profitByUser: Map<string, number>;
  if (range === "week") {
    // Lucro da semana = resultado realizado nos últimos 7 dias (trades,
    // resoluções e ajustes admin). Grants/bônus ficam de fora: não são lucro.
    const agg = await prisma.pointsTransaction.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: weekStart! },
        type: { in: ["TRADE_SETTLE", "RESOLUTION_PAYOUT", "ADMIN_ADJUST"] },
      },
      _sum: { amount: true },
    });
    profitByUser = new Map(agg.map((r) => [r.userId, r._sum.amount ?? 0]));
  } else {
    const positions = await prisma.position.findMany({
      where: { qty: { gt: 0 } },
      include: { market: { select: { lastPrice: true } } },
    });

    const posValue = new Map<string, number>();
    for (const p of positions) {
      posValue.set(p.userId, (posValue.get(p.userId) ?? 0) + p.qty * p.market.lastPrice);
    }

    profitByUser = new Map(
      users.map((u) => [
        u.id,
        u.balance + u.escrow + (posValue.get(u.id) ?? 0) - u.totalGranted,
      ]),
    );
  }

  const rows: LeaderboardRow[] = users
    .map((u) => {
      return {
        id: u.id,
        name: u.name,
        profit: profitByUser.get(u.id) ?? 0,
        volume: volumeByUser.get(u.id) ?? 0,
      };
    })
    .filter((r) => r.profit !== 0 || r.volume !== 0)
    .sort((a, b) => b.profit - a.profit);

  return rows;
}

export async function getPricePoints(marketId: string, range: "d1" | "week" | "month" | "all") {
  const since = {
    d1: 24 * 3600 * 1000,
    week: 7 * 24 * 3600 * 1000,
    month: 30 * 24 * 3600 * 1000,
    all: Number.POSITIVE_INFINITY,
  }[range];
  return prisma.pricePoint.findMany({
    where: since === Number.POSITIVE_INFINITY
      ? { marketId }
      : { marketId, ts: { gte: new Date(Date.now() - since) } },
    orderBy: { ts: "asc" },
    select: { priceCents: true, ts: true },
  });
}

export async function getComments(eventId: string) {
  return prisma.comment.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
  });
}

export interface UserPointsInfo {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  balance: number;
  totalGranted: number;
  level: number;
}

/** Dados de pontos/nível para um usuário (para gamificação de propostas). */
export async function getUserPointsInfo(userId: string): Promise<UserPointsInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      balance: true,
      totalGranted: true,
    },
  });
  if (!user) return null;
  return { ...user, level: getUserLevel(user.totalGranted) };
}

export async function getUserProposals(userId: string) {
  return prisma.marketProposal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      market: { select: { id: true, question: true, event: { select: { slug: true, title: true } } } },
    },
  });
}

export async function getPendingProposals() {
  const proposals = await prisma.marketProposal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      market: { select: { id: true } },
    },
  });
  return proposals;
}

/** Dashboard do admin: estatísticas gerais. */
export async function getAdminStats() {
  const [events, markets, users, trades, pending] = await Promise.all([
    prisma.event.count(),
    prisma.market.count(),
    prisma.user.count(),
    prisma.trade.count(),
    prisma.marketProposal.count({ where: { status: "PENDING" } }),
  ]);
  return { events, markets, users, trades, pending };
}