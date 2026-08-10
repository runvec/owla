import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getMarketWithEvent, getOrderBook, getRecentTrades, getPricePoints } from "@/lib/queries";
import MarketClient, { type MarketSnapshot } from "@/components/MarketClient";

export default async function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const market = await getMarketWithEvent(id);
  if (!market) notFound();

  const [book, trades, pricePoints, myOrders, myPositions] = await Promise.all([
    getOrderBook(id),
    getRecentTrades(id, 40),
    getPricePoints(id, "d1"),
    prisma.order.findMany({
      where: { userId: user.id, marketId: id, status: { in: ["OPEN", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.position.findMany({
      where: { userId: user.id, marketId: id, qty: { gt: 0 } },
      orderBy: { side: "asc" },
    }),
  ]);

  const initial: MarketSnapshot = {
    market: {
      id: market.id,
      question: market.question,
      status: market.status,
      lastPrice: market.lastPrice,
      volume: market.volume,
      pairs: market.pairs,
      rulesText: market.rulesText,
    },
    event: {
      slug: market.event.slug,
      title: market.event.title,
      category: market.event.category,
      imageUrl: market.event.imageUrl,
      endsAt: market.event.endsAt.toISOString(),
    },
    book,
    trades: trades.map((t) => ({
      id: t.id,
      priceCents: t.priceCents,
      qty: t.qty,
      kind: t.kind,
      takerName: t.taker.name,
      createdAt: t.createdAt.toISOString(),
    })),
    pricePoints: pricePoints.map((p) => ({ priceCents: p.priceCents, ts: p.ts.toISOString() })),
    myOrders: myOrders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    myPositions: myPositions.map((p) => ({ id: p.id, side: p.side, qty: p.qty, avgCostCents: p.avgCostCents })),
  };

  return <MarketClient initial={initial} marketId={id} />;
}