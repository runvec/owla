"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import type { PositionRow } from "@/lib/queries";
import { fmtN, fmtPts, pct, timeAgo, MARKET_STATUS_LABEL } from "@/lib/format";
import { SIDE_LABEL } from "@/lib/product-language";

export interface HistoryRow {
  id: string;
  amount: number;
  type: string;
  label: string;
  refId: string | null;
  createdAt: string;
}

export interface PortfolioUser {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: number;
  escrow: number;
  totalGranted: number;
  netWorth: number;
  profit: number;
  positionValue: number;
  positions: number;
}

export interface PortfolioPayload {
  user: PortfolioUser;
  positions: PositionRow[];
  history: HistoryRow[];
}

interface PortfolioResponse {
  ok: boolean;
  user: PortfolioUser;
  positions: PositionRow[];
  history: HistoryRow[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Erro ao carregar seus palpites");
  return body;
};

function fmtSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${fmtN(n)} pts`;
}

function summaryCard(label: string, value: string, tint?: "emerald" | "rose" | "zinc") {
  const color =
    tint === "emerald"
      ? "text-signal"
      : tint === "rose"
        ? "text-rose-600"
        : "text-ink";
  return (
    <div className="rounded-xl border border-mist bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export default function PortfolioPanel({ initial }: { initial: PortfolioPayload }) {
  const [tab, setTab] = useState<"positions" | "history">("positions");
  const { data } = useSWR<PortfolioResponse>("/api/portfolio", fetcher, {
    refreshInterval: 5000,
    fallbackData: { ok: true, ...initial },
  });

  const user = data?.user ?? initial.user;
  const positions = data?.positions ?? initial.positions;
  const history = data?.history ?? initial.history;

  const tabs = [
    { id: "positions" as const, label: "Palpites ativos" },
    { id: "history" as const, label: "Histórico" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCard("Disponíveis", fmtPts(user.balance), "zinc")}
        {summaryCard("Reservados", fmtPts(user.escrow), "zinc")}
        {summaryCard("Pontuação estimada", fmtPts(user.netWorth), "zinc")}
        {summaryCard("Desempenho", fmtSigned(user.profit), user.profit < 0 ? "rose" : "emerald")}
      </div>

      <div className="rounded-xl border border-mist bg-white shadow-sm">
        <div className="flex gap-1 border-b border-mist p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-owla text-white"
                  : "text-ink/60 hover:bg-mist hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "positions" ? (
          positions.length === 0 ? (
            <p className="p-6 text-sm text-ink/50">Nenhum palpite ativo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mist text-left text-xs uppercase tracking-wide text-ink/50">
                    <th className="px-4 py-2 font-medium">Pergunta</th>
                    <th className="px-4 py-2 font-medium">Escolha</th>
                    <th className="px-4 py-2 text-right font-medium">Unidades</th>
                    <th className="px-4 py-2 text-right font-medium">Chance média</th>
                    <th className="px-4 py-2 text-right font-medium">Chance atual</th>
                    <th className="px-4 py-2 text-right font-medium">Variação estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={`${p.marketId}-${p.side}`} className="border-b border-mist last:border-0">
                      <td className="max-w-[280px] px-4 py-3">
                        <Link href={`/market/${p.marketId}`} className="group block">
                          <span className="block text-xs text-ink/50">{p.eventTitle}</span>
                          <span className="block truncate font-medium text-ink group-hover:text-owla">
                            {p.question}
                          </span>
                          <span className="mt-0.5 inline-block rounded border border-mist px-1 text-[10px] uppercase text-ink/50">
                            {MARKET_STATUS_LABEL[p.marketStatus] ?? p.marketStatus}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                            p.side === "YES"
                              ? "bg-signal/10 text-signal"
                              : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {SIDE_LABEL[p.side]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-ink">{fmtN(p.qty)}</td>
                      <td className="px-4 py-3 text-right text-ink/80">{pct(p.avgCostCents)}</td>
                      <td className="px-4 py-3 text-right text-ink/80">{pct(p.lastPrice)}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          p.unrealized > 0
                            ? "text-signal"
                            : p.unrealized < 0
                              ? "text-rose-600"
                              : "text-ink/80"
                        }`}
                      >
                        {fmtSigned(p.unrealized)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : history.length === 0 ? (
          <p className="p-6 text-sm text-ink/50">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="divide-y divide-mist">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{h.label}</p>
                  <p className="text-xs text-ink/50">{timeAgo(h.createdAt)}</p>
                </div>
                <span
                  className={`font-mono text-sm font-semibold ${
                    h.amount > 0 ? "text-signal" : h.amount < 0 ? "text-rose-600" : "text-ink/50"
                  }`}
                >
                  {fmtSigned(h.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
