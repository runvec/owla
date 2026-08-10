import Link from "next/link";
import Image from "next/image";
import type { EventFeedItem } from "@/lib/queries";
import { MARKET_STATUS_LABEL, fmtN, pct } from "@/lib/format";

export type EventCardItem = Omit<EventFeedItem, "endsAt"> & { endsAt: Date | string };

function endsIn(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "encerrado";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `encerra em ${days} d`;
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `encerra em ${hours} h`;
  if (minutes > 0) return `encerra em ${minutes} min`;
  return "encerra em instantes";
}

export default function EventCard({ event }: { event: EventCardItem }) {
  const price = event.price;
  return (
    <Link
      href={`/event/${event.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-mist bg-white shadow-sm transition-colors hover:border-owla/40 hover:shadow-md"
    >
      {event.imageUrl ? (
        <Image
          src={event.imageUrl}
          alt={event.title}
          width={400}
          height={144}
          className="h-36 w-full object-cover"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-mist via-cloud to-white">
          <span className="text-3xl">🦉</span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-indigo-profundo">
            {event.category}
          </span>
          <span className="ml-auto text-[10px] text-ink/50">
            {MARKET_STATUS_LABEL[event.status] ?? event.status} · {endsIn(event.endsAt)}
          </span>
        </div>

        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-owla">
          {event.title}
        </h3>

        <div className="mt-auto space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink/50">SIM</span>
            <span className="num text-2xl font-bold text-signal">{pct(price)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-signal transition-[width]"
              style={{ width: `${price ?? 0}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-ink/50">
            <span>Vol: {fmtN(event.totalVolume)} pts</span>
            {event.markets.length > 0 && <span>{event.markets.length} mercado(s)</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}