"use client";

import { useState } from "react";
import { pct, fmtN, timeAgo } from "@/lib/format";
import { DIRECTION_LABEL, ORDER_STATUS_LABEL, ORDER_TYPE_LABEL, SIDE_LABEL } from "@/lib/product-language";

export interface OrderRow {
  id: string;
  side: "YES" | "NO";
  direction: "BUY" | "SELL";
  priceCents: number;
  qty: number;
  filledQty: number;
  type: string;
  status: string;
  createdAt: string;
}

interface Props {
  orders: OrderRow[] | null;
  onChanged: () => void;
}

export default function MyOrders({ orders, onChanged }: Props) {
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Meus palpites pendentes</h2>
        <p className="text-sm text-ink/50">Você não tem palpites aguardando confirmação.</p>
      </div>
    );
  }

  function cancel(orderId: string) {
    setCancelingId(orderId);
    setError(null);
    fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "Falha ao cancelar.");
        }
        onChanged();
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao cancelar."))
      .finally(() => setCancelingId(null));
  }

  return (
    <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Meus palpites pendentes</h2>
      <ul className="space-y-2">
        {orders.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between gap-2 rounded-xl bg-mist px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={o.side === "YES" ? "font-medium text-signal" : "font-medium text-rose-600"}>
                  {SIDE_LABEL[o.side]}
                </span>
                <span className="font-medium text-ink/80">
                  {DIRECTION_LABEL[o.direction]} · chance {pct(o.priceCents)}
                </span>
                <span className="text-ink/50">{ORDER_STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
              <p className="text-xs text-ink/50">
                {fmtN(o.qty)} unidades · {fmtN(o.filledQty)} confirmadas · {ORDER_TYPE_LABEL[o.type] ?? o.type} · {timeAgo(o.createdAt)}
              </p>
            </div>
            <button
              onClick={() => cancel(o.id)}
              disabled={cancelingId === o.id}
              className="shrink-0 rounded-lg border border-mist px-2.5 py-1 text-xs text-ink/70 transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
            >
              {cancelingId === o.id ? "Cancelando..." : "Cancelar"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
