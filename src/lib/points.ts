import { prisma } from "@/lib/prisma";

export const SIGNUP_GRANT = Number(process.env.SIGNUP_GRANT ?? 10000);
export const DAILY_BONUS = Number(process.env.DAILY_BONUS ?? 250);

/** Pontos acumulados necessários para subir cada nível. */
export const LEVEL_THRESHOLD = Number(process.env.LEVEL_THRESHOLD ?? 5000);

/** Nível exigido para propor mercado. */
export const PROPOSAL_LEVEL_REQUIREMENT = Number(process.env.PROPOSAL_LEVEL_REQUIREMENT ?? 2);

/** Pontuação (totalGranted) mínima exigida para propor mercado. */
export const PROPOSAL_POINTS_REQUIREMENT = Number(process.env.PROPOSAL_POINTS_REQUIREMENT ?? 500);

export interface UserLevelInfo {
  level: number;
  nextLevelAt: number;
  progressToNext: number;
}

/**
 * Nível do usuário baseado no total de pontos concedidos (vida).
 * A cada LEVEL_THRESHOLD pontos, o nível sobe 1.
 */
export function getUserLevel(totalGranted: number): number {
  if (totalGranted < 0) return 0;
  return Math.floor(totalGranted / LEVEL_THRESHOLD);
}

/** Informações de nível derivadas de totalGranted. */
export function getUserLevelInfo(totalGranted: number): UserLevelInfo {
  const level = getUserLevel(totalGranted);
  const nextLevelAt = (level + 1) * LEVEL_THRESHOLD;
  const progressToNext =
    LEVEL_THRESHOLD > 0
      ? Math.min(1, Math.max(0, (totalGranted - level * LEVEL_THRESHOLD) / LEVEL_THRESHOLD))
      : 0;
  return { level, nextLevelAt, progressToNext };
}

/**
 * Um usuário pode propor mercado se atender EITHER a exigência de pontos
 * (totalGranted >= PROPOSAL_POINTS_REQUIREMENT) OR a exigência de nível
 * (level >= PROPOSAL_LEVEL_REQUIREMENT). O bloqueio ocorre apenas quando
 * AMBAS falham — evita spammers sem atividade alguma mas não pune usuários
 * ativos.
 */
export function canPropose(totalGranted: number): boolean {
  const level = getUserLevel(totalGranted);
  return totalGranted >= PROPOSAL_POINTS_REQUIREMENT || level >= PROPOSAL_LEVEL_REQUIREMENT;
}

/** Motivo (legível) pelo qual o usuário não pode propor. */
export function proposalDisabledReason(totalGranted: number): string | null {
  if (canPropose(totalGranted)) return null;
  const level = getUserLevel(totalGranted);
  return (
    `Você precisa de ${PROPOSAL_POINTS_REQUIREMENT} pontos concedidos ` +
    `ou atingir o nível ${PROPOSAL_LEVEL_REQUIREMENT} (você tem ${totalGranted} pontos e está no nível ${level}). ` +
    `Interaja com algumas perguntas e receba os pontos diários para desbloquear o envio de sugestões.`
  );
}

/**
 * Concede o bônus de cadastro (uma única vez, no fim do signup).
 * Grava transação SIGNUP_GRANT e atualiza balance/totalGranted.
 */
export async function grantSignup(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.pointsTransaction.create({
      data: { userId, amount: SIGNUP_GRANT, type: "SIGNUP_GRANT" },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: SIGNUP_GRANT },
        totalGranted: { increment: SIGNUP_GRANT },
      },
    });
  });
}

/**
 * Reivindica o bônus diário (uma vez por dia civil UTC, atômico — o UPDATE
 * condicional trava a linha do usuário; um segundo claim paralelo no mesmo
 * dia obtém count=0 e é rejeitado).
 */
export async function claimDailyBonus(
  userId: string,
): Promise<{ claimed: boolean; amount: number }> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const dayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const res = await tx.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastBonusAt: null }, { lastBonusAt: { lt: dayStart } }],
      },
      data: {
        balance: { increment: DAILY_BONUS },
        totalGranted: { increment: DAILY_BONUS },
        lastBonusAt: now,
      },
    });
    if (res.count === 0) {
      return { claimed: false, amount: 0 };
    }
    await tx.pointsTransaction.create({
      data: { userId, amount: DAILY_BONUS, type: "DAILY_BONUS" },
    });
    return { claimed: true, amount: DAILY_BONUS };
  });
}

/** Ajuste administrativo manual (pode ser positivo ou negativo). */
export async function adminAdjust(
  userId: string,
  amount: number,
  note: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: amount },
        totalGranted: { increment: Math.max(0, amount) },
      },
    });
    await tx.pointsTransaction.create({
      data: { userId, amount, type: "ADMIN_ADJUST", refId: note },
    });
  });
}

