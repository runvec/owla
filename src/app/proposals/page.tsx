import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getUserProposals } from "@/lib/queries";
import { timeAgo } from "@/lib/format";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Aguardando", cls: "bg-market-amber/15 text-ink border-market-amber/50" },
  APPROVED: { label: "Aprovada", cls: "bg-signal/10 text-signal border-signal/30" },
  REJECTED: { label: "Recusada", cls: "bg-rose-50 text-rose-600 border-rose-200" },
};

export default async function ProposalsPage() {
  const user = await requireUser();
  const proposals = await getUserProposals(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Minhas sugestões</h1>
        <p className="text-sm text-ink/60">Acompanhe o status das suas sugestões de pergunta.</p>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-xl border border-mist bg-white p-10 text-center">
          <p className="text-sm text-ink/60">Você ainda não enviou sugestões.</p>
          <Link
            href="/propose"
            className="mt-4 inline-block rounded-lg bg-owla px-4 py-2 text-sm font-semibold text-white hover:bg-owla-dark"
          >
            Enviar minha primeira sugestão
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const meta = STATUS_META[p.status] ?? STATUS_META.PENDING;
            return (
              <li
                key={p.id}
                className="rounded-xl border border-mist bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{p.question}</p>
                    <p className="mt-1 text-xs text-ink/50">
                      {p.category} · enviada {timeAgo(p.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.cls}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {p.status === "APPROVED" && p.market?.id ? (
                  <Link
                    href={`/market/${p.market.id}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-signal hover:text-signal/80"
                  >
                    Ver pergunta →
                  </Link>
                ) : null}

                {p.status === "REJECTED" && p.adminNote ? (
                  <p className="mt-3 rounded-lg border border-mist bg-mist/60 px-3 py-2 text-sm text-ink/80">
                    <span className="font-medium text-ink/60">Motivo: </span>
                    {p.adminNote}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
