"use client";

import { SWRConfig } from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ fetcher }}>{children}</SWRConfig>;
}