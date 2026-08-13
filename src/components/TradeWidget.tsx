"use client";

import { useState } from "react";
import { pct, fmtN, fmtPts } from "@/lib/format";
import { DIRECTION_LABEL, ORDER_STATUS_MESSAGE, ORDER_TYPE_LABEL, POINTS_DISCLAIMER, SIDE_LABEL } from "@/lib/product-language";

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

interface OrderResult {
  orderId: string;
  filledQty: number;
  remainingQty: number;
  status: string;
  averagePriceCents: number | null;
}

interface Props {
  marketId: string;
  book: Book;
  selected: Selection | null;
  onSelect: (sel: Selection | null) => void;
  open: boolean;
  onPlaced: () => void;
}

type OrderPayload = {
  marketId: string;
  side: "YES" | "NO";
  direction: "BUY" | "SELL";
  priceCents: number;
  qty: number;
  type: "GTC" | "FAK";
};

const STATUS_TEXT = ORDER_STATUS_MESSAGE;

function bestPrice(book: Book, side: "YES" | "NO"): number {
  if (side === "YES") {
    const ask = book.asks[0];
    return ask ? ask.priceCents : 50;
  }
  const bid = book.bids[0];
  return bid ? 100 - bid.priceCents : 50;
}

export default function TradeWidget({ marketId, book, selected, onSelect, open, onPlaced }: Props) {
  const [mode, setMode] = useState<"simples" | "avancado">("simples");
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
  const [priceStr, setPriceStr] = useState("");
  const [qtyStr, setQtyStr] = useState("1");
  const [type, setType] = useState<"GTC" | "FAK">("GTC");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  const priceCents =
    selected?.side === side && selected.priceCents != null ? selected.priceCents : bestPrice(book, side);

  const amountNum = Number(amount);
  const previewQty = amountNum > 0 && priceCents >= 1 ? Math.floor(amountNum / priceCents) : 0;
  const previewCost = previewQty * priceCents;

  function place() {
    setError(null);
    setNeedLogin(false);
    setResult(null);

    if (!open) {
      setError("Esta pergunta não está aceitando palpites.");
      return;
    }

    let payload: OrderPayload;
    if (mode === "simples") {
      if (!amountNum || amountNum <= 0) {
        setError("Informe quantos pontos quer usar.");
        return;
      }
      if (previewQty <= 0) {
        setError(`Pontos insuficientes: são necessários ${fmtPts(priceCents)} por unidade.`);
        return;
      }
      payload = { marketId, side, direction: "BUY", priceCents, qty: previewQty, type: "FAK" };
    } else {
      const p = Number(priceStr);
      const q = Number(qtyStr);
      if (!Number.isInteger(p) || p < 1 || p > 99) {
        setError("A chance deve ser um número inteiro entre 1 e 99.");
        return;
      }
      if (!Number.isInteger(q) || q < 1) {
        setError("Quantidade deve ser um inteiro positivo.");
        return;
      }
      payload = { marketId, side, direction, priceCents: p, qty: q, type };
    }

    setBusy(true);
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (res.status === 401) {
          setNeedLogin(true);
          setError("Sua sessão expirou.");
          return;
        }
        if (!res.ok) {
          setError(json?.error ?? "Não foi possível enviar o palpite.");
          return;
        }
        setResult(json.result as OrderResult);
        onPlaced();
      })
      .catch(() => setError("Erro de conexão. Tente novamente."))
      .finally(() => setBusy(false));
  }

  return (
    <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink/70">Fazer palpite</h2>
        <div className="flex rounded-lg bg-mist p-0.5 text-xs">
          {(["simples", "avancado"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                mode === m
                  ? "rounded-md bg-owla px-2 py-1 text-white"
                  : "px-2 py-1 text-ink/60 hover:text-ink"
              }
            >
              {m === "simples" ? "Simples" : "Avançado"}
            </button>
          ))}
        </div>
      </div>

      {!open && (
        <div className="mb-3 rounded-xl border border-market-amber/50 bg-market-amber/15 px-3 py-2 text-sm text-ink">
          Esta pergunta não está aceitando novos palpites.
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSide("YES")}
            disabled={!open}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              side === "YES" ? "bg-signal text-white" : "bg-mist text-ink/60 hover:text-ink"
            }`}
          >
            {SIDE_LABEL.YES}
          </button>
          <button
            onClick={() => setSide("NO")}
            disabled={!open}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              side === "NO" ? "bg-rose-500 text-white" : "bg-mist text-ink/60 hover:text-ink"
            }`}
          >
            {SIDE_LABEL.NO}
          </button>
        </div>

        {mode === "simples" ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-ink/50">Quantos pontos?</label>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex.: 1000"
                disabled={!open}
                className="w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink outline-none focus:border-owla"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-ink/50">
                Chance: <strong className="text-ink">{pct(priceCents)}</strong>
                {selected?.side === side && selected.priceCents != null && (
                  <button
                    onClick={() => onSelect(null)}
                    className="ml-1 text-ink/50 hover:text-ink/80"
                    title="Voltar para a melhor chance"
                  >
                    (dos palpites em aberto ✕)
                  </button>
                )}
              </span>
              {amountNum > 0 && priceCents >= 1 && (
                <span className="text-ink/50">
                  ≈ {fmtN(previewQty)} unidades · {fmtPts(previewCost)}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDirection("BUY")}
                disabled={!open}
                className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  direction === "BUY" ? "bg-signal text-white" : "bg-mist text-ink/60 hover:text-ink"
                }`}
              >
                {DIRECTION_LABEL.BUY}
              </button>
              <button
                onClick={() => setDirection("SELL")}
                disabled={!open}
                className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  direction === "SELL" ? "bg-rose-500 text-white" : "bg-mist text-ink/60 hover:text-ink"
                }`}
              >
                {DIRECTION_LABEL.SELL}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-ink/50">Chance (1–99)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder={String(priceCents)}
                  disabled={!open}
                  className="w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink outline-none focus:border-owla"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink/50">Unidades</label>
                <input
                  type="number"
                  min={1}
                  value={qtyStr}
                  onChange={(e) => setQtyStr(e.target.value)}
                  disabled={!open}
                  className="w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink outline-none focus:border-owla"
                />
              </div>
            </div>
            <div className="flex gap-2">
              {(["GTC", "FAK"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  disabled={!open}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                    type === t ? "bg-owla text-white" : "bg-mist text-ink/60 hover:text-ink"
                  }`}
                >
                  {ORDER_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={place}
          disabled={busy || !open}
          className={`w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
            side === "YES" ? "bg-signal text-white hover:bg-signal/90" : "bg-rose-500 text-white hover:bg-rose-400"
          }`}
        >
          {busy
            ? "Confirmando..."
            : mode === "simples"
              ? "Confirmar palpite"
              : `${DIRECTION_LABEL[direction]} ${SIDE_LABEL[side]}`}
        </button>

        {result && (
          <div className="rounded-xl border border-signal/30 bg-signal/10 p-3 text-sm text-signal">
            <p className="font-medium">{STATUS_TEXT[result.status] ?? "Palpite enviado."}</p>
            <p className="mt-1 text-signal/80">
              {fmtN(result.filledQty)} de {fmtN(result.filledQty + result.remainingQty)} unidades confirmadas
              {result.averagePriceCents != null && ` · chance média ${pct(result.averagePriceCents)}`}
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-600">
            {needLogin ? (
              <>
                {error}{" "}
                <a href="/login" className="underline">
                  Entrar novamente
                </a>
              </>
            ) : (
              error
            )}
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-ink/40">{POINTS_DISCLAIMER}</p>
      </div>
    </div>
  );
}
