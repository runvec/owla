"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

const EXAMPLES = [
  "O Brasil vence a Copa do Mundo de 2026?",
  "Bitcoin encerra o ano acima de US$ 100 mil?",
  "O filme X ganha o Oscar de Melhor Filme?",
];

interface ProposalFormProps {
  categories: string[];
  disabled?: boolean;
  lockMessage?: string;
}

const inputCls =
  "w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export default function ProposalForm({ categories, disabled = false, lockMessage }: ProposalFormProps) {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Outros");
  const [placeholder] = useState(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const valid = question.trim().length >= 5;

  if (disabled && lockMessage) {
    return (
      <div className="space-y-4 rounded-xl border border-market-amber/50 bg-market-amber/15 p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl" aria-hidden>
            🔒
          </span>
          <p className="text-sm text-ink">{lockMessage}</p>
        </div>
        <div className="space-y-3 opacity-60">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink/80">Pergunta (A favor/Contra)</label>
            <textarea
              value="(bloqueado — você ainda não atingiu o requisito para sugerir perguntas)"
              readOnly
              rows={3}
              maxLength={200}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-ink/50">Mínimo de 5 caracteres · máximo 200.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink/80">Contexto (opcional)</label>
            <textarea readOnly rows={3} maxLength={2000} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink/80">Categoria</label>
            <select disabled value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled className="w-full cursor-not-allowed rounded-lg bg-mist px-4 py-2.5 text-sm font-semibold text-ink/50">
          Sugestão bloqueada
        </button>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      setError("A pergunta precisa ter pelo menos 5 caracteres.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: question.trim(), context: context.trim(), category }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Não foi possível enviar a sugestão.");
        return;
      }
      setDone(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-signal/30 bg-signal/5 p-6 text-sm text-ink">
        <p className="text-base font-semibold text-signal">Sugestão enviada!</p>
        <p className="mt-1 text-ink/60">Status: aguardando revisão do administrador.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/proposals"
            className="rounded-lg bg-owla px-4 py-2 text-sm font-semibold text-white hover:bg-owla-dark"
          >
            Ver minhas sugestões
          </Link>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setQuestion("");
              setContext("");
            }}
            className="rounded-lg border border-mist px-4 py-2 text-sm font-medium text-ink/70 hover:border-owla hover:text-owla"
          >
            Fazer outra sugestão
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-mist bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="question" className="mb-1.5 block text-sm font-medium text-ink/80">
          Pergunta (A favor/Contra)
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={200}
          className={inputCls}
        />
        <p className="mt-1 text-xs text-ink/50">Mínimo de 5 caracteres · máximo 200.</p>
      </div>

      <div>
        <label htmlFor="context" className="mb-1.5 block text-sm font-medium text-ink/80">
          Contexto <span className="text-ink/50">(opcional)</span>
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Regras, fontes e detalhes que ajudem a definir o resultado…"
          rows={3}
          maxLength={2000}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-ink/80">
          Categoria
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputCls}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-owla px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-owla-dark disabled:opacity-50"
      >
        {submitting ? "Enviando…" : "Enviar sugestão"}
      </button>
    </form>
  );
}
