import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { resolveMarket } from "@/lib/resolve";
import { publicEngineErrorMessage } from "@/lib/product-language";
import type { ResolutionOutcome } from "@/lib/resolve";
import { resolveInputSchema, unwrap } from "@/lib/validation";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  let input: { outcome: ResolutionOutcome };
  try {
    input = unwrap(resolveInputSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  try {
    await resolveMarket(id, input.outcome);
    return NextResponse.json({ ok: true, outcome: input.outcome });
  } catch (e) {
    const message = msg(e);
    const status = message.includes("já resolvido")
      ? 409
      : message.includes("Feche o mercado")
        ? 400
        : message.includes("não encontrado")
          ? 404
          : 400;
    return NextResponse.json({ error: publicEngineErrorMessage(message) }, { status });
  }
}
