"use client";

import { pct, fmtN } from "@/lib/format";

export interface BookLine {
  priceCents: number;
  qty: number;
}

export interface Book {
  bids: BookLine[];
  asks: BookLine[];
}

export interface Selection {
  side: "YES" | "NO";
  priceCents: number | null;
}

interface Props {
  book: Book;
  selected: Selection | null;
  onSelect: (sel: Selection) => void;
}

const MAX_ROWS = 6;

export default function OrderBook({ book, selected, onSelect }: Props) {
  const { bids, asks } = book;
  const maxBid = Math.max(1, ...bids.map((b) => b.qty));
  const maxAsk = Math.max(1, ...asks.map((a) => a.qty));

  if (bids.length === 0 && asks.length === 0) {
    return (
      <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Livro de ofertas</h2>
        <p className="text-sm text-ink/50">Livro vazio — seja o primeiro a oferecer.</p>
      </div>
    );
  }

  const renderLines = (lines: BookLine[], max: number, side: "YES" | "NO") =>
    lines.slice(0, MAX_ROWS).map((line) => {
      const priceCents = side === "NO" ? 100 - line.priceCents : line.priceCents;
      const active = selected?.side === side && selected.priceCents === priceCents;
      const accent = side === "YES" ? "bg-signal/10 text-signal" : "bg-rose-50 text-rose-600";
      return (
        <button
          key={line.priceCents}
          onClick={() => onSelect({ side, priceCents })}
          className={`relative block w-full overflow-hidden rounded-md px-2 py-1 text-left text-sm transition-colors ${
            active ? "ring-1 ring-signal" : "hover:bg-mist"
          }`}
        >
          <span
            className={`absolute inset-y-0 right-0 ${side === "YES" ? "bg-signal/15" : "bg-rose-100"}`}
            style={{ width: `${Math.min(100, (line.qty / max) * 100)}%` }}
          />
          <span className="relative flex items-center justify-between">
            <span className={`font-medium ${accent}`}>{pct(priceCents)}</span>
            <span className="text-ink/50">{fmtN(line.qty)}</span>
          </span>
        </button>
      );
    });

  return (
    <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink/70">Livro de ofertas</h2>
        <span className="text-xs text-ink/50">Clique num preço para usar no widget</span>
      </div>
      <div className="mb-1 grid grid-cols-[1fr_1fr] gap-2 px-1 text-[11px] text-ink/50">
        <span>Comprar YES</span>
        <span className="text-right">Vender YES</span>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div className="space-y-0.5">
          {bids.length > 0 ? (
            renderLines(bids, maxBid, "YES")
          ) : (
            <p className="px-2 py-1 text-xs text-ink/40">Sem compras</p>
          )}
        </div>
        <div className="space-y-0.5">
          {asks.length > 0 ? (
            renderLines(asks, maxAsk, "NO")
          ) : (
            <p className="px-2 py-1 text-right text-xs text-ink/40">Sem ofertas de venda</p>
          )}
        </div>
      </div>
    </div>
  );
}