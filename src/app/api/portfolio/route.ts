import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { getUserSummary, getPositions, getHistory } from "@/lib/queries";
import { LEDGER_LABEL } from "@/lib/product-language";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function GET(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const [summary, positions, history] = await Promise.all([
      getUserSummary(user.id),
      getPositions(user.id),
      getHistory(user.id),
    ]);

    const historyRows = history.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      label: LEDGER_LABEL[t.type] ?? t.type,
      refId: t.refId,
      createdAt: t.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, user: summary, positions, history: historyRows });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}
