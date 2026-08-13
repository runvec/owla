const nf = new Intl.NumberFormat("pt-BR");

export function pct(priceCents: number | null | undefined): string {
  if (priceCents == null) return "—";
  return `${Math.round(priceCents)}%`;
}

export function fmtN(n: number): string {
  return nf.format(n);
}

export function fmtPts(n: number): string {
  return `${nf.format(n)} pts`;
}

export function timeAgo(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d atrás`;
  return date.toLocaleDateString("pt-BR");
}

export { ORDER_TYPE_LABEL, QUESTION_STATUS_LABEL as MARKET_STATUS_LABEL } from "@/lib/product-language";
