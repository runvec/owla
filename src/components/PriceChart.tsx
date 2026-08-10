"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { createChart, ColorType, AreaSeries, CrosshairMode } from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";

export interface PricePoint {
  priceCents: number;
  ts: string;
}

const RANGES = [
  { key: "d1", label: "1D" },
  { key: "week", label: "1S" },
  { key: "month", label: "1M" },
  { key: "all", label: "Tudo" },
] as const;

type Range = (typeof RANGES)[number]["key"];

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? `Erro ${res.status}`);
  return json as { pricePoints: PricePoint[] };
};

function toSeriesData(points: PricePoint[]) {
  const byTime = new Map<number, number>();
  for (const p of points) {
    const t = Math.floor(new Date(p.ts).getTime() / 1000);
    byTime.set(t, p.priceCents);
  }
  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}

export default function PriceChart({
  marketId,
  points,
}: {
  marketId: string;
  points: PricePoint[];
}) {
  const [range, setRange] = useState<Range>("d1");
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const { data } = useSWR<{ pricePoints: PricePoint[] }>(
    `/api/markets/${marketId}/snapshot?range=${range}`,
    fetcher,
    {
      fallbackData: { pricePoints: points },
      keepPreviousData: true,
      refreshInterval: 3000,
    },
  );

  const chartPoints = data?.pricePoints ?? points;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined") return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#5b6472",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(20,26,38,0.06)" },
        horzLines: { color: "rgba(20,26,38,0.06)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      localization: { locale: "pt-BR", priceFormatter: (price: number) => `${price}%` },
      crosshair: { mode: CrosshairMode.Normal },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#19C8A3",
      topColor: "rgba(25, 200, 163, 0.35)",
      bottomColor: "rgba(25, 200, 163, 0.02)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 3,
      priceFormat: { type: "custom", minMove: 1, formatter: (price: number) => `${price}%` },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    if (series) series.setData(toSeriesData(chartPoints));
  }, [chartPoints]);

  return (
    <div className="rounded-2xl border border-mist bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink/70">Histórico de preços</h2>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={
                range === r.key
                  ? "rounded-md bg-owla px-2 py-1 text-xs text-white"
                  : "rounded-md px-2 py-1 text-xs text-ink/50 hover:bg-mist hover:text-ink/70"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {chartPoints.length === 0 ? (
        <p className="flex h-64 items-center justify-center text-sm text-ink/50">Sem histórico de preços ainda.</p>
      ) : (
        <div ref={containerRef} className="h-64 w-full" />
      )}
    </div>
  );
}