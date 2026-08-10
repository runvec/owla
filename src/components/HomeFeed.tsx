"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import EventCard, { type EventCardItem } from "@/components/EventCard";

interface EventsResponse {
  ok?: boolean;
  events?: EventCardItem[];
  categories?: string[];
  error?: string;
}

const SORTS = [
  { value: "trending", label: "Em alta" },
  { value: "ending", label: "Encerrando" },
  { value: "new", label: "Novos" },
];

function buildKey(category: string, search: string, sort: string): string {
  const qs = new URLSearchParams();
  if (category && category !== "todas") qs.set("category", category);
  if (search) qs.set("search", search);
  qs.set("sort", sort);
  const s = qs.toString();
  return s ? `/api/events?${s}` : "/api/events";
}

export default function HomeFeed() {
  const [category, setCategory] = useState("todas");
  const [sort, setSort] = useState("trending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, error } = useSWR<EventsResponse>(buildKey(category, search, sort), {
    refreshInterval: 15000,
  });

  const events = data?.events ?? [];
  const categories = data?.categories ?? [];

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-ink">Mercados</h1>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar mercados…"
            className="w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none sm:max-w-xs"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink focus:border-owla focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory("todas")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
              category === "todas"
                ? "bg-owla text-white"
                : "bg-mist text-ink/60 hover:text-ink"
            }`}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                category === c
                  ? "bg-owla text-white"
                  : "bg-mist text-ink/60 hover:text-ink"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading && !data ? (
        <p className="py-12 text-center text-sm text-ink/50">Carregando mercados…</p>
      ) : error || data?.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 py-12 text-center text-sm text-rose-600">
          Não foi possível carregar os mercados. Tente novamente em instantes.
        </p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-mist bg-white py-12 text-center">
          <p className="text-sm text-ink/60">Nenhum mercado encontrado.</p>
          <p className="mt-1 text-xs text-ink/40">Tente ajustar a busca ou os filtros.</p>
          <button
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setCategory("todas");
            }}
            className="mt-4 rounded-full border border-mist px-4 py-1.5 text-xs text-ink/70 hover:border-owla hover:text-owla"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}