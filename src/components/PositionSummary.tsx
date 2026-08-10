"use client";

import { pct, fmtN, fmtPts } from "@/lib/format";

export interface PositionRow {
  id: string;
  side: "YES" | "NO";
  qty: number;
  avgCostCents: number;
}

interface Props {
  positions: PositionRow[] | null;
  lastPrice: number;
}

export default function PositionSummary({ positions, lastPrice }: Props) {
  if (!positions || positions.length === 0) {
    return (
      <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Minha posição</h2>
        <p className="text-sm text-ink/50">Você ainda não tem posição neste mercado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Minha posição</h2>
      <ul className="space-y-2">
        {positions.map((pos) => {
          const current = pos.side === "YES" ? lastPrice : 100 - lastPrice;
          const pnl = (current - pos.avgCostCents) * pos.qty;
          const pnlClass = pnl > 0 ? "text-signal" : pnl < 0 ? "text-rose-600" : "text-ink/50";
          return (
            <li key={pos.id} className="rounded-xl bg-mist px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink/80">
                  <span className={pos.side === "YES" ? "text-signal" : "text-rose-600"}>{pos.side}</span> ·{" "}
                  {fmtN(pos.qty)} cotas
                </span>
                <span className={`font-medium ${pnlClass}`}>
                  {pnl > 0 ? "+" : ""}
                  {fmtPts(pnl)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink/50">
                Custo médio {pct(pos.avgCostCents)} · atual {pct(current)} · P&L não realizado
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}