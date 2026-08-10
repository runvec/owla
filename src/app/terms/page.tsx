import Link from "next/link";

export const metadata = {
  title: "Termos de Uso — Owla",
  description: "Termos de uso da plataforma Owla.",
};

const sections = [
  {
    title: "1. Plataforma de entretenimento",
    body: "A Owla é uma plataforma de entretenimento e não constitui aposta, jogo de azar ou serviço financeiro. O acesso é feito com pontos fictícios, sem qualquer valor pecuniário real.",
  },
  {
    title: "2. Pontos sem valor",
    body: "Os pontos não têm valor monetário e não podem ser comprados, vendidos, transferidos entre usuários ou convertidos em dinheiro, presentes, créditos ou qualquer outro ativo reparável.",
  },
  {
    title: "3. Proibição de transações",
    body: "É proibida a compra, venda, troca, transferência ou qualquer outra forma de comercialização de pontos entre usuários ou com terceiros. Contas envolvidas em tais práticas poderão ser suspensas ou encerradas.",
  },
  {
    title: "4. Pontuação por interação",
    body: "Os pontos são ganhos exclusivamente por meio de interações dentro da plataforma, como bônus diários e recompensas de atividade. O histórico de pontuação é permanente e registrado por essas interações.",
  },
  {
    title: "5. Administração da plataforma",
    body: "Os administradores podem encerrar, ajustar ou suspender eventos, mercados e contas a qualquer momento, inclusive para corrigir erros, abusos ou comportamentos que violem estas regras.",
  },
  {
    title: "6. Sem garantia",
    body: "A plataforma é fornecida no estado em que se encontra ('as is'), sem garantias de qualquer natureza. Os resultados de eventos e mercados não conferem qualquer direito real ou financeiro.",
  },
  {
    title: "7. Aviso legal (Lei brasileira)",
    body: "Em conformidade com a legislação brasileira (Lei nº 1.506/1946 e disposições sobre contravenções de jogo), a Owla NÃO é uma aposta ou jogo de azar com dinheiro: não há pagamento de entrada, prêmio em dinheiro, valor monetário ou chance de lucro financeiro. Os únicos 'prêmios' são pontos simbólicos e a diversão.",
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