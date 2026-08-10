"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import useSWR from "swr";
import { fmtPts } from "@/lib/format";

interface HeaderUser {
  name: string;
  role: string;
}

interface MePayload {
  ok: boolean;
  user?: { balance: number } | null;
  bonusEligible?: boolean;
  error?: string;
}

const NAV = [
  { href: "/", label: "Mercados" },
  { href: "/portfolio", label: "Carteira" },
  { href: "/leaderboard", label: "Ranking" },
  { href: "/propose", label: "Propor mercado" },
  { href: "/proposals", label: "Minhas propostas" },
];

export default function Header({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, mutate } = useSWR<MePayload>(user ? "/api/me" : null, {
    refreshInterval: 5000,
  });
  const [claiming, setClaiming] = useState(false);
  const [bonusMsg, setBonusMsg] = useState<string | null>(null);

  const balance = data?.user?.balance;

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  async function handleClaim() {
    setClaiming(true);
    setBonusMsg(null);
    try {
      const res = await fetch("/api/bonus", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setBonusMsg(json.error ?? "Não foi possível resgatar o bônus.");
        return;
      }
      setBonusMsg(json.amount != null ? `+${json.amount} pts resgatados!` : "Bônus resgatado!");
      await mutate();
    } catch {
      setBonusMsg("Erro de conexão ao resgatar o bônus.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-mist bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/owl-mark.png" alt="Owla" width={236} height={210} className="h-8 w-auto" priority />
            <span className="text-lg font-bold tracking-tight text-indigo-profundo">Owla</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {bonusMsg && (
                <span className="hidden max-w-[160px] truncate text-xs text-signal lg:inline">
                  {bonusMsg}
                </span>
              )}
              <div className="hidden items-center gap-2 sm:flex">
                <span className="rounded-full bg-market-amber/20 px-3 py-1 text-xs font-medium text-ink">
                  <span className="num">{fmtPts(balance ?? 0)}</span>
                </span>
              </div>
              {data?.bonusEligible && (
                <button
                  onClick={handleClaim}
                  disabled={claiming}
                  className="rounded-full bg-signal px-3 py-1 text-xs font-medium text-white hover:bg-signal/90 disabled:opacity-50"
                >
                  {claiming ? "Resgatando…" : "Bônus diário 🎁"}
                </button>
              )}
              <span className="hidden text-xs text-ink/60 md:inline">
                {user.name.split(" ")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-mist px-3 py-1 text-xs text-ink/70 hover:border-owla hover:text-owla"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full px-3 py-1 text-sm text-ink/70 hover:text-owla"
              >
                Entrar
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-owla px-3 py-1 text-sm font-medium text-white hover:bg-owla-dark"
              >
                Criar conta
              </Link>
            </div>
          )}
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto pb-2 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1 ${
                  active ? "bg-owla text-white" : "text-ink/60 hover:bg-mist hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={`whitespace-nowrap rounded-full px-3 py-1 ${
                pathname.startsWith("/admin")
                  ? "bg-owla text-white"
                  : "text-ink/60 hover:bg-mist hover:text-ink"
              }`}
            >
              Admin
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}