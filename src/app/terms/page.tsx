import Link from "next/link";
import { POINTS_DISCLAIMER } from "@/lib/product-language";

export const metadata = {
  title: "Termos de Uso — Owla",
  description: "Termos de uso da plataforma Owla.",
};

const sections = [
  {
    title: "1. Plataforma de entretenimento",
    body: "A Owla é uma plataforma de entretenimento com perguntas sobre acontecimentos futuros e palpites feitos exclusivamente com pontos virtuais.",
  },
  {
    title: "2. Pontos sem valor",
    body: POINTS_DISCLAIMER,
  },
  {
    title: "3. Proibição de transações",
    body: "É proibida a compra, venda, troca, transferência ou qualquer outra forma de comercialização de pontos entre usuários ou com terceiros. Contas envolvidas em tais práticas poderão ser suspensas ou encerradas.",
  },
  {
    title: "4. Pontuação por interação",
    body: "Os pontos são recebidos gratuitamente no cadastro, diariamente ou por ajustes administrativos. O histórico de pontuação registra as interações realizadas na plataforma.",
  },
  {
    title: "5. Administração da plataforma",
    body: "Os administradores podem encerrar, ajustar ou suspender eventos, perguntas e contas, inclusive para corrigir erros, abusos ou comportamentos que violem estas regras.",
  },
  {
    title: "6. Sem garantia",
    body: "A plataforma é fornecida no estado em que se encontra ('as is'), sem garantias de disponibilidade ou exatidão. Resultados e pontos não conferem qualquer direito real ou financeiro.",
  },
  {
    title: "7. Sem pagamentos ou prêmios",
    body: "A Owla não cobra para conceder pontos e não oferece dinheiro, cripto, bens, descontos, créditos, serviços ou qualquer item resgatável como resultado dos palpites.",
  },
];

export default function TermsPage() {
  return (
    <div className="animate-fade-in mx-auto max-w-2xl space-y-6">
      <Link href="/" className="text-sm text-ink/60 hover:text-ink">
        ← Voltar
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-ink">Owla — Termos de Uso</h1>
        <p className="mt-1 text-xs text-ink/50">Última atualização: agosto de 2026.</p>
      </header>

      {sections.map((s) => (
        <section key={s.title} className="space-y-1">
          <h2 className="text-sm font-semibold text-ink/80">{s.title}</h2>
          <p className="text-sm leading-relaxed text-ink/60">{s.body}</p>
        </section>
      ))}

      <p className="border-t border-mist pt-4 text-xs text-ink/40">
        Ao criar uma conta na Owla, você declara ter lido e concordar com estes termos. Dúvidas?
        Fale com os administradores da plataforma.
      </p>
    </div>
  );
}
