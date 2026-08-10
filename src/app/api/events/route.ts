import { NextRequest, NextResponse } from "next/server";
import { getCategories, getEventFeed, type FeedSort } from "@/lib/queries";

const VALID_SORTS: FeedSort[] = ["trending", "ending", "new"];

export async function GET(req: NextRequest): Promise<Response> {
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") ?? undefined;
  const search = sp.get("search") ?? undefined;
  const sortParam = sp.get("sort") ?? "trending";
  const sort: FeedSort = VALID_SORTS.includes(sortParam as FeedSort)
    ? (sortParam as FeedSort)
    : "trending";

  try {
    const [events, categories] = await Promise.all([
      getEventFeed({ category, search, sort }),
      getCategories(),
    ]);
    return NextResponse.json({
      ok: true,
      categories,
      events: events.map((e) => ({
        ...e,
        endsAt: e.endsAt.toISOString(),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}