import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { getUserProposals, getUserPointsInfo } from "@/lib/queries";
import { getUserLevel, PROPOSAL_LEVEL_REQUIREMENT, PROPOSAL_POINTS_REQUIREMENT, canPropose } from "@/lib/points";
import { proposalInputSchema, unwrap } from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function GET(): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const proposals = await getUserProposals(user.id);
    return NextResponse.json({ ok: true, proposals });
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

  let input: { question: string; context?: string; category: string };
  try {
    input = unwrap(proposalInputSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  const rl = await rateLimit(`proposal:${user.id}`, RATE_LIMITS.proposal.limit, RATE_LIMITS.proposal.windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas propostas em pouco tempo. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  const userInfo = await getUserPointsInfo(user.id);
  if (!userInfo) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  if (!canPropose(userInfo.totalGranted)) {
    const level = getUserLevel(userInfo.totalGranted);
    return NextResponse.json(
      {
        error: `Você precisa de ${PROPOSAL_POINTS_REQUIREMENT} pontos concedidos ou atingir o nível ${PROPOSAL_LEVEL_REQUIREMENT} para propor mercados. Você tem ${userInfo.totalGranted} pontos (nível ${level}). Interaja com mercados e reivencione o bônus diário para desbloquear.`,
        code: "INSUFFICIENT_LEVEL",
        required: {
          points: PROPOSAL_POINTS_REQUIREMENT,
          level: PROPOSAL_LEVEL_REQUIREMENT,
        },
        current: {
          totalGranted: userInfo.totalGranted,
          balance: userInfo.balance,
          level,
        },
      },
      { status: 403 },
    );
  }

  try {
    const proposal = await prisma.marketProposal.create({
      data: {
        userId: user.id,
        question: input.question,
        context: input.context || null,
        category: input.category,
        status: "PENDING",
      },
    });
    return NextResponse.json({ ok: true, proposal }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}