import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/queries";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function GET(req: NextRequest): Promise<Response> {
  const range = req.nextUrl.searchParams.get("range") === "week" ? "week" : "all";

  try {
    const rows = await getLeaderboard(range);
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}