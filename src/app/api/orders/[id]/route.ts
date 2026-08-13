import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { cancelOrder } from "@/lib/engine";
import { publicEngineErrorMessage } from "@/lib/product-language";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  try {
    await cancelOrder(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = msg(e);
    const status = message.includes("não encontrada") ? 404 : 400;
    return NextResponse.json({ error: publicEngineErrorMessage(message) }, { status });
  }
}
