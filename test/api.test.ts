import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { POST as registerPOST } from "@/app/api/auth/register/route";
import { GET as eventsGET } from "@/app/api/events/route";
import { NextRequest } from "next/server";

const RUN = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let seqCounter = 0;
const seq = () => `${RUN}-${++seqCounter}`;

const createdUsers: string[] = [];

const json = (body: unknown, ip?: string) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    body: JSON.stringify(body),
  });

describe("api /auth/register", () => {
  it("registra um usuário novo e concede o bônus de cadastro", async () => {
    const email = `api-${seq()}@test.local`;
    const res = await registerPOST(
      json({ name: "API Test", email, password: "senha-forte-123", acceptTerms: true }, "203.0.113.1"),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe("USER");
    createdUsers.push(user!.id);

    const tx = await prisma.pointsTransaction.findFirst({
      where: { userId: user!.id, type: "SIGNUP_GRANT" },
    });
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBeGreaterThan(0);
  });

  it("rejeita e-mail duplicado com 409", async () => {
    const email = `api-dup-${seq()}@test.local`;
    const first = await registerPOST(
      json({ name: "Dup", email, password: "senha-forte-123", acceptTerms: true }, "203.0.113.2"),
    );
    expect(first.status).toBe(201);
    const created = await prisma.user.findUnique({ where: { email } });
    createdUsers.push(created!.id);

    const second = await registerPOST(
      json({ name: "Dup2", email, password: "outra-senha-123", acceptTerms: true }, "203.0.113.2"),
    );
    expect(second.status).toBe(409);
  });

  it("rejeita dados inválidos com 400", async () => {
    const res = await registerPOST(
      json({ name: "X", email: "email-invalido", password: "curta", acceptTerms: false }, "203.0.113.3"),
    );
    expect(res.status).toBe(400);
  });

  it("bloqueia cadastros em excesso do mesmo IP (429)", async () => {
    const ip = "203.0.113.4";
    for (let i = 0; i < RATE_LIMITS.register.limit; i++) {
      const res = await registerPOST(
        json(
          { name: `Flood${i}`, email: `api-flood-${seq()}@test.local`, password: "senha-forte-123", acceptTerms: true },
          ip,
        ),
      );
      expect(res.status).toBe(201);
    }

    const blocked = await registerPOST(
      json({ name: "Blocked", email: `api-flood-${seq()}@test.local`, password: "senha-forte-123", acceptTerms: true }, ip),
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).not.toBeNull();
  });
});

describe("api /events", () => {
  it("retorna feed e categorias", async () => {
    const req = new NextRequest("http://localhost/api/events?sort=trending");
    const res = await eventsGET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.events)).toBe(true);
    expect(Array.isArray(body.categories)).toBe(true);
  });
});

describe("rate-limit persistente", () => {
  beforeAll(async () => {
    // Garante que a tabela existe (migration aplicada) e limpa a chave de teste.
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `test-rl-${RUN}` } } });
  });

  it("permite até o limite e bloqueia a partir daí", async () => {
    const key = `test-rl-${RUN}-${seq()}`;
    const limit = 3;
    const windowMs = 60_000;

    for (let i = 0; i < limit; i++) {
      const r = await rateLimit(key, limit, windowMs);
      expect(r.ok).toBe(true);
    }

    const blocked = await rateLimit(key, limit, windowMs);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("reinicia a janela após expirar", async () => {
    const key = `test-rl-${RUN}-${seq()}`;
    const limit = 1;
    // Janela de 1ms: a primeira chamada já expira antes da segunda.
    const first = await rateLimit(key, limit, 1);
    expect(first.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    const second = await rateLimit(key, limit, 1);
    expect(second.ok).toBe(true);
  });

  it("chaves diferentes são independentes", async () => {
    const k1 = `test-rl-${RUN}-a`;
    const k2 = `test-rl-${RUN}-b`;
    const limit = 1;
    expect((await rateLimit(k1, limit, 60_000)).ok).toBe(true);
    expect((await rateLimit(k1, limit, 60_000)).ok).toBe(false);
    expect((await rateLimit(k2, limit, 60_000)).ok).toBe(true);
  });

  it("RATE_LIMITS expõe limites configurados", () => {
    expect(RATE_LIMITS.order.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.comment.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.proposal.limit).toBeGreaterThan(0);
  });
});

afterAll(async () => {
  const floodUsers = await prisma.user.findMany({
    where: { email: { startsWith: "api-flood-" } },
    select: { id: true },
  });
  const all = [...createdUsers, ...floodUsers.map((u) => u.id)];
  await prisma.pointsTransaction.deleteMany({ where: { userId: { in: all } } });
  await prisma.user.deleteMany({ where: { id: { in: all } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `test-rl-${RUN}` } } });
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "register:" } } });
  await prisma.$disconnect();
});
