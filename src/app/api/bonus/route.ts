import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { claimDailyBonus } from "@/lib/points";

export async function POST(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const result = await claimDailyBonus(user.id);
    return NextResponse.json({ ok: true, claimed: result.claimed, amount: result.amount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}