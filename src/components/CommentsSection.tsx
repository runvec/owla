"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { timeAgo } from "@/lib/format";

interface CommentItem {
  id: string;
  body: string;
  createdAt: string | Date;
  user: { id: string; name: string };
}

interface CommentsResponse {
  ok?: boolean;
  comments?: CommentItem[];
  error?: string;
}

interface MeResponse {
  user?: unknown;
}

export default function CommentsSection({ eventId }: { eventId: string }) {
  const key = `/api/comments?eventId=${encodeURIComponent(eventId)}`;
  const { data, isLoading, mutate } = useSWR<CommentsResponse>(key, {
    refreshInterval: 3000,
  });
  const { data: me, isLoading: meLoading } = useSWR<MeResponse>("/api/me", {
    refreshInterval: 60000,
  });

  const authenticated = Boolean(me?.user);
  const comments = data?.comments ?? [];

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, body: body.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) setError("Você precisa fazer login para comentar.");
        else setError(json.error ?? "Não foi possível enviar o comentário.");
        return;
      }
      setBody("");
      await mutate();
    } catch {
      setError("Erro de conexão ao enviar o comentário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {meLoading ? null : authenticated ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Escreva um comentário…"
            className="w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="rounded-full bg-owla px-4 py-1.5 text-xs font-medium text-white hover:bg-owla-dark disabled:opacity-50"
          >
            {submitting ? "Enviando…" : "Comentar"}
          </button>
        </form>
      ) : (
        <p className="text-xs text-ink/50">
          <Link href="/login" className="text-owla hover:underline">
            Faça login
          </Link>{" "}
          para comentar.
        </p>
      )}

      {error && authenticated && <p className="text-xs text-rose-600">{error}</p>}

      {isLoading && !data ? (
        <p className="py-4 text-center text-xs text-ink/40">Carregando comentários…</p>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-xs text-ink/40">
          Nenhum comentário ainda. Seja a primeira!
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-mist bg-white p-3 shadow-sm">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-indigo-profundo">{c.user.name}</span>
                <span className="text-[10px] text-ink/50">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}