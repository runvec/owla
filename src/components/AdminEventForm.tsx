"use client";

import { useState, type FormEvent } from "react";

const FALLBACK_CATEGORIES = [
  "Política",
  "Esportes",
  "Cripto",
  "Economia",
  "Entretenimento",
  "Tecnologia",
  "Outros",
];

interface MarketDraft {
  id: number;
  question: string;
  rulesText: string;
}

interface AdminEventFormProps {
  categories?: string[];
  onCreated?: () => void;
}

const inputCls =
  "w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function nowLocalInput(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminEventForm({ categories, onCreated }: AdminEventFormProps) {
  const options = categories && categories.length > 0 ? categories : FALLBACK_CATEGORIES;

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(options[0] ?? "Outros");
  const [endsAt, setEndsAt] = useState(nowLocalInput());
  const [markets, setMarkets] = useState<MarketDraft[]>([
    { id: 0, question: "", rulesText: "" },
  ]);
  const [nextId, setNextId] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setMarket(id: number, patch: Partial<MarketDraft>) {
    setMarkets((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function addMarket() {
    setMarkets((ms) => [...ms, { id: nextId, question: "", rulesText: "" }]);
    setNextId((n) => n + 1);
  }

  function removeMarket(id: number) {
    setMarkets((ms) => (ms.length > 1 ? ms.filter((m) => m.id !== id) : ms));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const finalSlug = slug.trim() || slugify(title);
    if (title.trim().length < 5) {
      setError("O título precisa ter pelo menos 5 caracteres.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(finalSlug) || finalSlug.length < 3) {
      setError("Slug: apenas letras minúsculas, números e hífens (mín. 3).");
      return;
    }
    const ends = new Date(endsAt);
    if (!Number.isFinite(ends.getTime()) || ends.getTime() <= Date.now()) {
      setError("Defina uma data de encerramento no futuro.");
      return;
    }
    if (markets.some((m) => m.question.trim().length < 5)) {
      setError("Cada mercado precisa de uma pergunta com pelo menos 5 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: finalSlug,
          description: description.trim(),
          category,
          endsAt: ends.toISOString(),
            markets: markets.map((m) => ({
            question: m.question.trim(),
            rulesText: m.rulesText.trim(),
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Não foi possível criar o evento.");
        return;
      }
      setMessage("Evento criado com sucesso!");
      setTitle("");
      setSlug("");
      setDescription("");
      setEndsAt(nowLocalInput());
      setMarkets([{ id: 0, question: "", rulesText: "" }]);
      setNextId(1);
      onCreated?.();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-title" className="mb-1.5 block text-sm font-medium text-ink/80">
            Título
          </label>
          <input
            id="event-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (slug.trim() === "") setSlug(slugify(e.target.value));
            }}
            placeholder="Ex.: Quem vence o Brasileirão 2026?"
            maxLength={140}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="event-slug" className="mb-1.5 block text-sm font-medium text-ink/80">
            Slug
          </label>
          <input
            id="event-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="quem-vence-o-brasileirao-2026"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-category" className="mb-1.5 block text-sm font-medium text-ink/80">
            Categoria
          </label>
          <select
            id="event-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputCls}
          >
            {options.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="event-ends" className="mb-1.5 block text-sm font-medium text-ink/80">
            Encerra em
          </label>
          <input
            id="event-ends"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="event-description" className="mb-1.5 block text-sm font-medium text-ink/80">
          Descrição <span className="text-ink/50">(opcional)</span>
        </label>
        <textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputCls}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink/80">Mercados</p>
          <button
            type="button"
            onClick={addMarket}
            className="rounded-lg border border-mist px-3 py-1.5 text-sm font-medium text-ink/70 hover:border-owla hover:text-owla"
          >
            + Adicionar mercado
          </button>
        </div>

        {markets.map((m) => (
          <div key={m.id} className="space-y-2 rounded-lg border border-mist bg-cloud p-3">
            <div className="flex gap-2">
              <input
                value={m.question}
                onChange={(e) => setMarket(m.id, { question: e.target.value })}
                placeholder="Pergunta de SIM/NÃO do mercado"
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => removeMarket(m.id)}
                disabled={markets.length <= 1}
                className="shrink-0 rounded-lg border border-mist px-3 py-2 text-sm text-ink/50 hover:border-owla hover:text-owla disabled:opacity-40"
                title="Remover mercado"
              >
                ✕
              </button>
            </div>
            <input
              value={m.rulesText}
              onChange={(e) => setMarket(m.id, { rulesText: e.target.value })}
              placeholder="Regras de resolução (opcional)"
              className={inputCls}
            />
          </div>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg border border-signal/30 bg-signal/10 px-3 py-2 text-sm text-signal">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-owla px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-owla-dark disabled:opacity-50"
      >
        {submitting ? "Criando…" : "Criar evento"}
      </button>
    </form>
  );
}
