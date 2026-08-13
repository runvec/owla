"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmtN, pct, timeAgo, MARKET_STATUS_LABEL } from "@/lib/format";
import AdminEventForm from "@/components/AdminEventForm";

interface AdminStats {
  events: number;
  markets: number;
  users: number;
  trades: number;
  pending: number;
}

interface PendingProposal {
  id: string;
  question: string;
  context: string | null;
  category: string;
  createdAt: string | Date;
  user: { id: string; name: string; email: string };
  market: { id: string } | null;
}

interface AdminMarket {
  id: string;
  question: string;
  status: string;
  lastPrice: number;
  volume: number;
  event: {
    id: string;
    title: string;
    slug: string;
    category: string;
    status: string;
    endsAt: string | Date;
  };
}

interface AdminPanelProps {
  initialStats: AdminStats;
  initialPending: PendingProposal[];
  initialMarkets: AdminMarket[];
  categories?: string[];
}

type ResolutionOutcome = "YES" | "NO" | "VOID";

type ApiBody = { ok?: unknown; error?: unknown };

const api = async (url: string, init?: RequestInit): Promise<ApiBody> => {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as ApiBody;
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Falha na operação");
  }
  return body;
};

const TAB_LABELS: { id: "resumo" | "propostas" | "criar" | "mercados"; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "propostas", label: "Sugestões pendentes" },
  { id: "criar", label: "Criar evento" },
  { id: "mercados", label: "Perguntas" },
];

const btnPrimary =
  "rounded-lg bg-owla px-3 py-1.5 text-xs font-semibold text-white hover:bg-owla-dark disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-mist px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-owla hover:text-owla disabled:opacity-50";
const btnDanger =
  "rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50";

function statusBadge(status: string) {
  const base = "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold";
  switch (status) {
    case "OPEN":
      return `${base} border-signal/30 bg-signal/10 text-signal`;
    case "CLOSED":
      return `${base} border-mist bg-mist text-ink/70`;
    case "RESOLVED_YES":
      return `${base} border-market-amber/50 bg-market-amber/15 text-ink`;
    case "RESOLVED_NO":
      return `${base} border-rose-200 bg-rose-50 text-rose-600`;
    case "VOID":
      return `${base} border-blue-200 bg-blue-50 text-blue-600`;
    default:
      return `${base} border-mist bg-mist text-ink/50`;
  }
}

export default function AdminPanel({
  initialMarkets,
  initialPending,
  initialStats,
  categories,
}: AdminPanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"resumo" | "propostas" | "criar" | "mercados">("resumo");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({});
  const [outcomes, setOutcomes] = useState<Record<string, ResolutionOutcome>>({});

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na operação");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, { event: AdminMarket["event"]; markets: AdminMarket[] }>();
    for (const m of initialMarkets) {
      const g = map.get(m.event.id) ?? { event: m.event, markets: [] };
      g.markets.push(m);
      map.set(m.event.id, g);
    }
    return Array.from(map.values());
  }, [initialMarkets]);

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1 rounded-lg bg-mist p-1">
        {TAB_LABELS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-owla text-white"
                : "text-ink/60 hover:bg-white hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {[
            { label: "Eventos", value: initialStats.events },
            { label: "Perguntas", value: initialStats.markets },
            { label: "Usuários", value: initialStats.users },
            { label: "Palpites confirmados", value: initialStats.trades },
            { label: "Pendentes", value: initialStats.pending },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-mist bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-ink/60">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{fmtN(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "propostas" &&
        (initialPending.length === 0 ? (
          <p className="rounded-xl border border-mist bg-white p-8 text-center text-sm text-ink/60">
            Nenhuma sugestão pendente.
          </p>
        ) : (
          <ul className="space-y-3">
            {initialPending.map((p) => (
              <li key={p.id} className="rounded-xl border border-mist bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{p.question}</p>
                    <p className="mt-1 text-xs text-ink/50">
                      {p.category} · {p.user.name} ({p.user.email}) · {timeAgo(p.createdAt)}
                    </p>
                    {p.context ? (
                      <p className="mt-2 text-sm text-ink/60">{p.context}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md border border-market-amber/50 bg-market-amber/15 px-2 py-0.5 text-xs font-semibold text-ink">
                    Aguardando
                  </span>
                </div>

                {rejectOpen[p.id] ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={rejectNotes[p.id] ?? ""}
                      onChange={(e) =>
                        setRejectNotes((n) => ({ ...n, [p.id]: e.target.value }))
                      }
                      placeholder="Motivo da recusa (opcional)"
                      className="min-w-0 flex-1 rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className={btnDanger}
                      onClick={() =>
                        run(async () => {
                          await api(`/api/admin/proposals/${p.id}`, {
                            method: "POST",
                            body: JSON.stringify({
                              action: "REJECT",
                              note: rejectNotes[p.id] ?? "",
                            }),
                          });
                        })
                      }
                    >
                      Confirmar recusa
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectOpen((o) => ({ ...o, [p.id]: false }))}
                      className={btnGhost}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await api(`/api/admin/proposals/${p.id}`, {
                            method: "POST",
                            body: JSON.stringify({ action: "APPROVE" }),
                          });
                        })
                      }
                      className={btnPrimary}
                    >
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRejectOpen((o) => ({ ...o, [p.id]: true }))}
                      className={btnDanger}
                    >
                      Recusar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}

      {tab === "criar" && (
        <div className="rounded-xl border border-mist bg-white p-6">
          <AdminEventForm
            categories={categories}
            onCreated={() => {
              router.refresh();
            }}
          />
        </div>
      )}

      {tab === "mercados" && (
        <div className="space-y-6">
          {groups.length === 0 ? (
            <p className="rounded-xl border border-mist bg-white p-8 text-center text-sm text-ink/60">
              Nenhuma pergunta cadastrada.
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.event.id} className="rounded-xl border border-mist bg-white p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold text-ink">
                    <Link href={`/event/${g.event.slug}`} className="hover:text-owla">
                      {g.event.title}
                    </Link>
                    <span className="ml-2 text-xs font-normal text-ink/50">
                      {g.event.category} · {fmtN(g.markets.length)} pergunta(s)
                    </span>
                  </h2>
                </div>
                <div className="space-y-2">
                  {g.markets.map((m) => {
                    const outcome = outcomes[m.id] ?? "YES";
                    return (
                      <div
                        key={m.id}
                        className="rounded-lg border border-mist bg-cloud p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              href={`/market/${m.id}`}
                              className="text-sm font-medium text-ink hover:text-owla"
                            >
                              {m.question}
                            </Link>
                            <p className="mt-0.5 text-xs text-ink/50">
                              Chance {pct(m.lastPrice)} · Participação {fmtN(m.volume)} pts
                            </p>
                          </div>
                          <span className={statusBadge(m.status)}>
                            {MARKET_STATUS_LABEL[m.status] ?? m.status}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {m.status === "OPEN" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await api(`/api/admin/markets/${m.id}/close`, {
                                    method: "POST",
                                    body: JSON.stringify({ action: "close" }),
                                  });
                                })
                              }
                              className={btnGhost}
                            >
                              Encerrar palpites
                            </button>
                          )}

                          {m.status === "CLOSED" && (
                            <>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  run(async () => {
                                    await api(`/api/admin/markets/${m.id}/close`, {
                                      method: "POST",
                                      body: JSON.stringify({ action: "reopen" }),
                                    });
                                  })
                                }
                                className={btnGhost}
                              >
                                Reabrir palpites
                              </button>
                              <div className="flex items-center gap-2">
                                <select
                                  value={outcome}
                                  onChange={(e) =>
                                    setOutcomes((o) => ({
                                      ...o,
                                      [m.id]: e.target.value as ResolutionOutcome,
                                    }))
                                  }
                                  className="rounded-lg border border-mist bg-white px-2 py-1.5 text-xs text-ink focus:border-owla focus:outline-none"
                                >
                                  <option value="YES">A favor</option>
                                  <option value="NO">Contra</option>
                                  <option value="VOID">ANULAR</option>
                                </select>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    const label = outcome === "YES" ? "A favor" : outcome === "NO" ? "Contra" : "Anulada";
                                    if (!window.confirm(`Definir o resultado da pergunta como ${label}?`)) return;
                                    void run(async () => {
                                      await api(`/api/admin/markets/${m.id}/resolve`, {
                                        method: "POST",
                                        body: JSON.stringify({ outcome }),
                                      });
                                    });
                                  }}
                                  className={btnPrimary}
                                >
                                  Definir resultado
                                </button>
                              </div>
                            </>
                          )}

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Excluir a pergunta "${m.question}"?`)) return;
                              void run(async () => {
                                await api(`/api/admin/markets/${m.id}`, { method: "DELETE" });
                              });
                            }}
                            className={btnDanger}
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
