import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/session";
import { placeOrder } from "@/lib/engine";
import { getOrderBook } from "@/lib/queries";
import { orderInputSchema, unwrap } from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { publicEngineErrorMessage } from "@/lib/product-language";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro interno");

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const marketId = req.nextUrl.searchParams.get("marketId");
  if (!marketId) return NextResponse.json({ error: "marketId é obrigatório" }, { status: 400 });

  try {
    const [orders, book] = await Promise.all([
      prisma.order.findMany({
        where: { userId: user.id, marketId, status: { in: ["OPEN", "PARTIAL"] } },
        orderBy: { createdAt: "desc" },
      }),
      getOrderBook(marketId),
    ]);
    return NextResponse.json({ ok: true, orders, book });
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

  let parsed: ReturnType<typeof unwrap<typeof orderInputSchema>>;
  try {
    parsed = unwrap(orderInputSchema, body);
  } catch (e) {
    return NextResponse.json({ error: msg(e) }, { status: 400 });
  }

  const rl = await rateLimit(`order:${user.id}`, RATE_LIMITS.order.limit, RATE_LIMITS.order.windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitos pedidos em pouco tempo. Tente novamente em instantes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 0) / 1000)) } },
    );
  }

  try {
    const result = await placeOrder(user.id, parsed);
    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (e) {
    const message = msg(e);
    const status = message.includes("não encontrado")
      ? 404
      : message.includes("aberto") || message.includes("fechado")
        ? 409
        : 400;
    return NextResponse.json({ error: publicEngineErrorMessage(message) }, { status });
  }
}
