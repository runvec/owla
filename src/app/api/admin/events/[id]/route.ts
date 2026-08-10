import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.event.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}