import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/session";
import { closeMarket, reopenMarket } from "@/lib/resolve";
import { unwrap } from "@/lib/validation";

const actionSchema = z.object({
  action: z.enum(["close", "reopen"]),
});

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

  let input: { action: "close" | "reopen" };
  try {
    input = unwrap(actionSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  try {
    if (input.action === "close") {
      await closeMarket(id);
    } else {
      await reopenMarket(id);
    }
    return NextResponse.json({ ok: true, status: input.action === "close" ? "CLOSED" : "OPEN" });
  } catch (e) {
    const message = msg(e);
    const status = message.includes("não encontrado") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}