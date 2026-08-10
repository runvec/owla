import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { getUserSummary } from "@/lib/queries";

export async function GET(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const [summary, dbUser] = await Promise.all([
      getUserSummary(user.id),
      prisma.user.findUnique({ where: { id: user.id }, select: { lastBonusAt: true } }),
    ]);

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const bonusEligible = !dbUser?.lastBonusAt || dbUser.lastBonusAt < dayStart;

    return NextResponse.json({ ok: true, user: summary, bonusEligible });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}