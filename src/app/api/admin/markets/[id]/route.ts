import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { unwrap } from "@/lib/validation";

const patchSchema = z.object({
  question: z.string().trim().min(5).max(200).optional(),
  rulesText: z.string().trim().max(3000).optional().or(z.literal("")),
});

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function PATCH(
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

  let input: { question?: string; rulesText?: string };
  try {
    input = unwrap(patchSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  try {
    const existing = await prisma.market.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Pergunta não encontrada." }, { status: 404 });

    const data: Prisma.MarketUpdateInput = {};
    if (input.question !== undefined) data.question = input.question;
    if (input.rulesText !== undefined) data.rulesText = input.rulesText === "" ? null : input.rulesText;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const market = await prisma.market.update({ where: { id }, data });
    return NextResponse.json({ ok: true, market });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { id } = await params;

  try {
    const existing = await prisma.market.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Pergunta não encontrada." }, { status: 404 });

    const tradeCount = await prisma.trade.count({ where: { marketId: id } });
    if (tradeCount > 0) {
      return NextResponse.json(
        { error: "A pergunta possui palpites confirmados e não pode ser removida." },
        { status: 409 },
      );
    }

    await prisma.market.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}
