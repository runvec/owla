"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("reg") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="animate-fade-in mx-auto w-full max-w-sm rounded-xl border border-mist bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-ink">Entrar</h1>
      <p className="mb-6 text-xs text-ink/50">Acesse sua conta na Owla.</p>

      {registered && (
        <p className="mb-4 rounded-lg border border-signal/40 bg-signal/10 p-3 text-xs text-signal">
          Conta criada! Faça login para começar.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-xs text-ink/60">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink/60">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none"
          />
        </label>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-owla py-2 text-sm font-medium text-white hover:bg-owla-dark disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-ink/50">
        Não tem conta?{" "}
        <Link href="/signup" className="text-owla hover:underline">
          Criar conta
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink/50">
        <Link href="/terms" className="underline-offset-2 hover:text-ink hover:underline">
          Termos de Uso
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}