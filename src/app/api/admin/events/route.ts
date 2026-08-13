import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { eventInputSchema, marketInputSchema, unwrap } from "@/lib/validation";

const createEventSchema = eventInputSchema.extend({
  markets: z.array(marketInputSchema).min(1, "Adicione pelo menos uma pergunta").max(20),
});

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  let parsed: ReturnType<typeof unwrap<typeof createEventSchema>>;
  try {
    parsed = unwrap(createEventSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  try {
    const { slug, endsAt } = parsed;
    const existing = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "Slug já utilizado" }, { status: 409 });

    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: parsed.title,
          slug,
          description: parsed.description || null,
          category: parsed.category,
          imageUrl: parsed.imageUrl || null,
          endsAt: new Date(endsAt),
        },
      });
      const markets = await Promise.all(
        parsed.markets.map((m) =>
          tx.market.create({
            data: {
              eventId: event.id,
              question: m.question,
              rulesText: m.rulesText || null,
            },
          }),
        ),
      );
      return { ...event, markets };
    });

    return NextResponse.json({ ok: true, event: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}
