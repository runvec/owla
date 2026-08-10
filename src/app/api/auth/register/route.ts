import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { grantSignup } from "@/lib/points";
import { unwrap } from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter entre 2 e 80 caracteres").max(80),
  email: z
    .string()
    .trim()
    .email("E-mail inválido")
    .transform((e) => e.toLowerCase()),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres").max(128),
  acceptTerms: z.literal(true, "Você deve aceitar os termos de uso"),
});

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

/** IP do cliente por header de proxy (única fonte confiável em produção). */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request): Promise<Response> {
  const rl = await rateLimit(
    `register:${clientIp(req)}`,
    RATE_LIMITS.register.limit,
    RATE_LIMITS.register.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas contas criadas a partir deste IP. Tente novamente mais tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  let input: z.infer<typeof registerSchema>;
  try {
    input = unwrap(registerSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: "USER",
      },
    });
    await grantSignup(user.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 500 });
  }
}