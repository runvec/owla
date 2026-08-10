"use client";

import { useState } from "react";
import useSWR from "swr";
import PriceChart from "@/components/PriceChart";
import OrderBook from "@/components/OrderBook";
import TradeWidget from "@/components/TradeWidget";
import MyOrders from "@/components/MyOrders";
import PositionSummary from "@/components/PositionSummary";
import { pct, fmtN, fmtPts, timeAgo, MARKET_STATUS_LABEL } from "@/lib/format";

export type MarketStatus = "OPEN" | "CLOSED" | "RESOLVED_YES" | "RESOLVED_NO" | "VOID";
export type Side = "YES" | "NO";

export interface BookLine {
  priceCents: number;
  qty: number;
}

export interface MarketInfo {
  id: string;
  question: string;
  status: MarketStatus;
  lastPrice: number;
  volume: number;
  pairs: number;
  rulesText: string | null;
}

export interface EventInfo {
  slug: string;
  title: string;
  category: string;
  imageUrl: string | null;
  endsAt: string;
}

export interface TradeRow {
  id: string;
  priceCents: number;
  qty: number;
  kind: string;
  takerName: string | null;
  createdAt: string;
}

export interface PricePointRow {
  priceCents: number;
  ts: string;
}

export interface OrderRow {
  id: string;
  side: Side;
  direction: "BUY" | "SELL";
  priceCents: number;
  qty: number;
  filledQty: number;
  type: "GTC" | "FAK";
  status: string;
  createdAt: string;
}

export interface PositionRow {
  id: string;
  side: Side;
  qty: number;
  avgCostCents: number;
}

export interface MarketSnapshot {
  market: MarketInfo;
  event: EventInfo;
  book: { bids: BookLine[]; asks: BookLine[] };
  trades: TradeRow[];
  pricePoints: PricePointRow[];
  myOrders: OrderRow[] | null;
  myPositions: PositionRow[] | null;
}

export interface BookSelection {
  side: Side;
  priceCents: number | null;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
  return json as MarketSnapshot;
};

const KIND_LABEL: Record<string, string> = {
  MINT: "Criado",
  MERGE: "Fundido",
  TRANSFER: "Transferência",
};

export default function MarketClient({
  initial,
  marketId,
}: {
  initial: MarketSnapshot;
  marketId: string;
}) {
  const [selected, setSelected] = useState<BookSelection | null>(null);

  const { data, error, mutate } = useSWR<MarketSnapshot>(
    `/api/markets/${marketId}/snapshot`,
    fetcher,
    {
      fallbackData: initial,
      refreshInterval: (latest) => (latest?.market.status === "OPEN" ? 3000 : 0),
    },
  );

  const snap = data ?? initial;
  const { market, event } = snap;
  const isOpen = market.status === "OPEN";

  const banner: { text: string; className: string } | null =
    market.status === "RESOLVED_YES"
      ? { text: "Mercado resolvido: SIM — cada cota YES valeu 100 pts.", className: "border-signal/40 bg-signal/10 text-signal" }
      : market.status === "RESOLVED_NO"
        ? { text: "Mercado resolvido: NÃO — cada cota NO valeu 100 pts.", className: "border-rose-300 bg-rose-50 text-rose-600" }
        : market.status === "VOID"
          ? { text: "Mercado anulado — cada cota valeu 50 pts.", className: "border-market-amber/50 bg-market-amber/15 text-ink" }
          : market.status === "CLOSED"
            ? { text: "Negociação encerrada — aguardando resolução.", className: "border-market-amber/50 bg-market-amber/15 text-ink" }
            : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      {banner && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${banner.className}`}>{banner.text}</div>
      )}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
          <span className="rounded-full bg-mist px-2 py-0.5 text-ink/60">{event.category}</span>
          <span>{event.title}</span>
          <span className="text-ink/30">•</span>
          <span>Encerra em {new Date(event.endsAt).toLocaleString("pt-BR")}</span>
          {!isOpen && <span className="rounded-full bg-mist px-2 py-0.5 text-ink/60">{MARKET_STATUS_LABEL[market.status] ?? market.status}</span>}
        </div>
        <h1 className="text-2xl font-semibold leading-tight">{market.question}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/50">
          <span>
            Preço <strong className="text-ink">{pct(market.lastPrice)}</strong>
          </span>
          <span>Volume {fmtPts(market.volume)}</span>
          <span>Pares em circulação {fmtN(market.pairs)}</span>
        </div>
        {market.rulesText && <p className="text-sm text-ink/60">{market.rulesText}</p>}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <PriceChart marketId={marketId} points={snap.pricePoints} />
          <OrderBook book={snap.book} selected={selected} onSelect={setSelected} />
        </div>
        <aside className="space-y-4">
          <TradeWidget
            marketId={marketId}
            book={snap.book}
            selected={selected}
            onSelect={setSelected}
            open={isOpen}
            onPlaced={() => void mutate()}
          />
          <PositionSummary positions={snap.myPositions} lastPrice={market.lastPrice} />
          <MyOrders orders={snap.myOrders} onChanged={() => void mutate()} />
        </aside>
      </div>

      <section className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink/70">Negociações recentes</h2>
          {error && <span className="text-xs text-rose-600">Falha ao atualizar</span>}
        </div>
        {snap.trades.length === 0 ? (
          <p className="text-sm text-ink/50">Ainda não há negociações neste mercado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/50">
                  <th className="pb-2 font-medium">Preço</th>
                  <th className="pb-2 font-medium">Qtd</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium">Comprador</th>
                  <th className="pb-2 text-right font-medium">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {snap.trades.map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5 font-medium text-ink">{pct(t.priceCents)}</td>
                    <td className="py-1.5 text-ink/50">{fmtN(t.qty)}</td>
                    <td className="py-1.5 text-ink/50">{KIND_LABEL[t.kind] ?? t.kind}</td>
                    <td className="py-1.5 text-ink/50">{t.takerName ?? "—"}</td>
                    <td className="py-1.5 text-right text-ink/50">{timeAgo(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}