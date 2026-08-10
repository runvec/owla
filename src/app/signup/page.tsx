"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Informe seu nome.");
    if (!email.trim()) return setError("Informe seu e-mail.");
    if (password.length < 8) return setError("A senha deve ter no mínimo 8 caracteres.");
    if (!acceptTerms) return setError("Você deve aceitar os termos de uso.");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, acceptTerms: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível criar a conta.");
        return;
      }
      router.push("/login?reg=1");
    } catch {
      setError("Erro de conexão ao criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in mx-auto w-full max-w-sm rounded-xl border border-mist bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-ink">Criar conta</h1>
      <p className="mb-6 text-xs text-ink/50">
        Entretenimento com pontos — nada de dinheiro real.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-xs text-ink/60">Nome</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none"
          />
        </label>
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
            autoComplete="new-password"
            className="mt-1 w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:border-owla focus:outline-none"
          />
          <span className="mt-1 block text-[10px] text-ink/40">Mínimo de 8 caracteres.</span>
        </label>

        <label className="flex items-start gap-2 text-xs text-ink/60">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 border-mist bg-white text-ink focus:border-owla focus:outline-none"
          />
          <span>
            Li e aceito os{" "}
            <Link href="/terms" className="text-owla hover:underline">
              Termos de Uso
            </Link>
            .
          </span>
        </label>

        {error && <p className="text-xs text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-owla py-2 text-sm font-medium text-white hover:bg-owla-dark disabled:opacity-50"
        >
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-ink/50">
        Já tem conta?{" "}
        <Link href="/login" className="text-owla hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}