import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { adminProposalSchema, unwrap } from "@/lib/validation";

const PROPOSAL_EVENT_DAYS = 30;

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

function baseSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(title: string): Promise<string> {
  const base = baseSlug(title) || "mercado";
  for (let i = 0; i < 5; i++) {
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}

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

  let input: { action: "APPROVE" | "REJECT"; note?: string };
  try {
    input = unwrap(adminProposalSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  try {
    const proposal = await prisma.marketProposal.findUnique({ where: { id } });
    if (!proposal) return NextResponse.json({ error: "Sugestão não encontrada." }, { status: 404 });

    if (input.action === "REJECT") {
      await prisma.marketProposal.update({
        where: { id },
        data: { status: "REJECTED", adminNote: input.note || null },
      });
      return NextResponse.json({ ok: true, status: "REJECTED" });
    }

    if (proposal.status === "APPROVED") {
      return NextResponse.json({ error: "Sugestão já aprovada." }, { status: 409 });
    }

    const slug = await uniqueSlug(proposal.question);
    const endsAt = new Date(Date.now() + PROPOSAL_EVENT_DAYS * 24 * 3600 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          title: proposal.question,
          slug,
          description: proposal.context || null,
          category: proposal.category,
          endsAt,
        },
      });
      const market = await tx.market.create({
        data: {
          eventId: event.id,
          question: proposal.question,
          rulesText: proposal.context || null,
        },
      });
      await tx.marketProposal.update({
        where: { id },
        data: { status: "APPROVED", adminNote: input.note || null, marketId: market.id },
      });
      return { event, market };
    });

    return NextResponse.json(
      { ok: true, status: "APPROVED", marketUrl: `/event/${created.event.slug}`, eventId: created.event.id },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}
