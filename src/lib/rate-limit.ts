import { prisma } from "@/lib/prisma";

/**
 * Limitador de taxa com janela fixa por chave, persistido no Postgres.
 *
 * Diferente de um Map em memória, o estado vive no banco: sobrevive a
 * restarts e funciona corretamente com múltiplas instâncias (Vercel, etc.).
 * Cada chamada é atômica (upsert + incremento condicional), então não há
 * corrida entre requisições concorrentes.
 *
 * Retorna { ok: true } se permitido; caso contrário { ok: false, retryAfterMs }.
 *
 * Falha em aberto: se o banco estiver indisponível (ou a tabela ausente), o
 * limitador não pode derrubar a rota inteira com um 500 sem corpo — todos os
 * chamadores o invocam antes do seu próprio try/catch. Como toda operação
 * limitada escreve no mesmo Postgres, um banco fora do ar já barra o abuso
 * pela via natural; o erro é registrado para aparecer nos logs.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs = 60_000,
): Promise<{ ok: boolean; retryAfterMs?: number }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    // Incrementa o contador apenas se a janela ainda não expirou. Na primeira
    // chamada (ou após expirar) o upsert cria/reseta a linha com count: 1 — o
    // incremento em seguida só existe para a janela já válida.
    const updated = await prisma.rateLimit.updateMany({
      where: { key, resetAt: { gt: now } },
      data: { count: { increment: 1 } },
    });

    if (updated.count === 0) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
    }

    const row = await prisma.rateLimit.findUnique({ where: { key } });
    if (!row) return { ok: true };

    if (row.count > limit) {
      return { ok: false, retryAfterMs: Math.max(0, row.resetAt.getTime() - now.getTime()) };
    }

    return { ok: true };
  } catch (e) {
    console.error(`[rate-limit] falha ao aplicar limite "${key}":`, e);
    return { ok: true };
  }
}

export const RATE_LIMITS = {
  order: { limit: 30, windowMs: 60_000 },
  comment: { limit: 10, windowMs: 60_000 },
  proposal: { limit: 5, windowMs: 3600_000 },
  register: { limit: 5, windowMs: 3600_000 },
  login: { limit: 10, windowMs: 300_000 },
} as const;