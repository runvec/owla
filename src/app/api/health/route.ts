import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up", uptime: process.uptime() });
  } catch {
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
