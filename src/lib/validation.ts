import { z } from "zod";

export const orderInputSchema = z.object({
  marketId: z.string().min(1),
  side: z.enum(["YES", "NO"]),
  direction: z.enum(["BUY", "SELL"]),
  priceCents: z.number().int().min(1).max(99),
  qty: z.number().int().min(1).max(1_000_000),
  type: z.enum(["GTC", "FAK"]).default("FAK"),
});

export const commentInputSchema = z.object({
  eventId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

export const proposalInputSchema = z.object({
  question: z.string().trim().min(5).max(200),
  context: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(50),
});

export const eventInputSchema = z.object({
  title: z.string().trim().min(5).max(140),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug: apenas letras minúsculas, números e hífens"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.string().trim().min(1).max(50),
  imageUrl: z.string().trim().url().optional().or(z.literal("")),
  endsAt: z.string().datetime(),
});

export const marketInputSchema = z.object({
  question: z.string().trim().min(5).max(200),
  rulesText: z.string().trim().max(3000).optional().or(z.literal("")),
});

export const resolveInputSchema = z.object({
  outcome: z.enum(["YES", "NO", "VOID"]),
});

export const adminProposalSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export function unwrap<S extends z.ZodType<unknown>>(schema: S, data: unknown) {
  const res = schema.safeParse(data);
  if (!res.success) {
    const issues = res.error.issues.map((i) => i.message).join("; ");
    throw new Error(issues || "Dados inválidos");
  }
  return res.data as z.infer<S>;
}