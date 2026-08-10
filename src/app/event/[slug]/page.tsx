import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventDetail } from "@/lib/queries";
import { MARKET_STATUS_LABEL, pct } from "@/lib/format";
import CommentsSection from "@/components/CommentsSection";

function endsIn(endsAt: Date): string {
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return "Encerrado";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `Encerra em ${days} d ${hours} h`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `Encerra em ${hours} h ${minutes} min`;
  if (minutes > 0) return `Encerra em ${minutes} min`;
  return "Encerra em instantes";
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventDetail(slug);
  if (!event) notFound();

  return (
    <div className="animate-fade-in mx-auto max-w-3xl space-y-6">
      <Link href="/" className="text-sm text-ink/60 hover:text-ink">
        ← Voltar
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] uppercase tracking-wider text-indigo-profundo">
            {event.category}
          </span>
          <span className="text-[10px] text-ink/50">{endsIn(event.endsAt)}</span>
        </div>
        <h1 className="text-2xl font-bold text-ink">{event.title}</h1>
        {event.description && (
          <p className="text-sm leading-relaxed text-ink/60">{event.description}</p>
        )}
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-ink/70">
          Mercados ({event.markets.length})
        </h2>
        <div className="space-y-2">
          {event.markets.map((m) => (
            <Link
              key={m.id}
              href={`/market/${m.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-mist bg-white p-4 shadow-sm transition-colors hover:border-owla/40"
            >
              <div className="space-y-1">
                <p className="text-sm text-ink">{m.question}</p>
                <span className="text-xs text-ink/50">
                  {MARKET_STATUS_LABEL[m.status] ?? m.status}
                </span>
              </div>
              <div className="text-right">
                <span className="num text-lg font-bold text-signal">{pct(m.lastPrice)}</span>
                <p className="text-[10px] text-ink/50">SIM</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="pt-2">
        <h2 className="mb-3 text-sm font-medium text-ink/70">Comentários</h2>
        <CommentsSection eventId={event.id} />
      </section>
    </div>
  );
}