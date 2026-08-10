"use client";

import { useState } from "react";
import useSWR from "swr";
import { fmtN } from "@/lib/format";

interface LeaderboardRow {
  id: string;
  name: string;
  profit: number;
  volume: number;
}

interface LeaderboardResponse {
  ok: boolean;
  rows: LeaderboardRow[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Erro ao carregar ranking");
  return body;
};

function fmtSigned(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${fmtN(n)} pts`;
}

const MEDAL_CLASSES = [
  "bg-market-amber text-ink",
  "bg-slate-300 text-ink",
  "bg-orange-500 text-ink",
];

export default function LeaderboardTable() {
  const [metric, setMetric] = useState<"profit" | "volume">("profit");
  const [range, setRange] = useState<"all" | "week">("all");
  const { data } = useSWR<LeaderboardResponse>(
    `/api/leaderboard?range=${range}`,
    fetcher,
    { refreshInterval: 15000 },
  );

  const rows = [...(data?.rows ?? [])].sort((a, b) =>
    metric === "profit" ? b.profit - a.profit : b.volume - a.volume,
  );

  const activeBtn =
    "bg-owla text-white";
  const activeChip =
    "bg-owla text-white";
  const idleBtn =
    "text-ink/60 hover:bg-white hover:text-ink";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-mist p-1">
          {(
            [
              { id: "profit", label: "Ranking de lucro" },
              { id: "volume", label: "Ranking de volume" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMetric(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                metric === t.id ? activeBtn : idleBtn
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-mist p-1">
          {(
            [
              { id: "all", label: "Tudo" },
              { id: "week", label: "Semana" },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRange(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                range === r.id ? activeChip : idleBtn
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-mist bg-white p-8 text-center text-sm text-ink/50 shadow-sm">
          Ainda não há dados de ranking.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-mist bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mist text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Usuário</th>
                <th className="px-4 py-3 text-right font-medium">
                  {metric === "profit" ? "Lucro" : "Volume"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="border-b border-mist last:border-0">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        MEDAL_CLASSES[i] ?? "bg-mist text-ink/60"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-ink">{row.name}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      metric === "profit"
                        ? row.profit >= 0
                          ? "text-signal"
                          : "text-rose-600"
                        : "text-ink"
                    }`}
                  >
                    {metric === "profit"
                      ? fmtSigned(row.profit)
                      : `${fmtN(row.volume)} pts`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}