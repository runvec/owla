import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { getComments } from "@/lib/queries";
import { commentInputSchema, unwrap } from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function GET(req: NextRequest): Promise<Response> {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId é obrigatório" }, { status: 400 });

  try {
    const comments = await getComments(eventId);
    return NextResponse.json({ ok: true, comments });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  let input: { eventId: string; body: string };
  try {
    input = unwrap(commentInputSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  const rl = await rateLimit(`comment:${user.id}`, RATE_LIMITS.comment.limit, RATE_LIMITS.comment.windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Você está comentando rápido demais. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    const event = await prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true } });
    if (!event) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });

    const comment = await prisma.comment.create({
      data: { eventId: input.eventId, userId: user.id, body: input.body },
      include: { user: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}