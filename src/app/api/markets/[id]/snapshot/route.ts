import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { getMarketWithEvent, getOrderBook, getRecentTrades, getPricePoints } from "@/lib/queries";

const RANGES = ["d1", "week", "month", "all"] as const;
type Range = (typeof RANGES)[number];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const market = await getMarketWithEvent(id);
  if (!market) return NextResponse.json({ error: "Mercado não encontrado" }, { status: 404 });

  const rawRange = req.nextUrl.searchParams.get("range") ?? "d1";
  const range: Range = RANGES.includes(rawRange as Range) ? (rawRange as Range) : "d1";

  const user = await getAuthUser();

  try {
    const [book, trades, pricePoints] = await Promise.all([
      getOrderBook(id),
      getRecentTrades(id, 40),
      getPricePoints(id, range),
    ]);

    const [myOrders, myPositions] = user
      ? await Promise.all([
          prisma.order.findMany({
            where: { userId: user.id, marketId: id, status: { in: ["OPEN", "PARTIAL"] } },
            orderBy: { createdAt: "desc" },
          }),
          prisma.position.findMany({
            where: { userId: user.id, marketId: id, qty: { gt: 0 } },
            orderBy: { side: "asc" },
          }),
        ])
      : [null, null];

    return NextResponse.json({
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
      myOrders: myOrders?.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })) ?? null,
      myPositions:
        myPositions?.map((p) => ({ id: p.id, side: p.side, qty: p.qty, avgCostCents: p.avgCostCents })) ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
