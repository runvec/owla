import { requireUser } from "@/lib/session";
import { getUserSummary, getPositions, getHistory } from "@/lib/queries";
import PortfolioPanel, { type PortfolioPayload } from "@/components/PortfolioPanel";
import { LEDGER_LABEL } from "@/lib/product-language";

async function loadPortfolio(userId: string): Promise<PortfolioPayload> {
  const [user, positions, history] = await Promise.all([
    getUserSummary(userId),
    getPositions(userId),
    getHistory(userId),
  ]);

  return {
    user,
    positions,
    history: history.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      label: LEDGER_LABEL[t.type] ?? t.type,
      refId: t.refId,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export default async function PortfolioPage() {
  const user = await requireUser();
  const initial = await loadPortfolio(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Meus palpites</h1>
        <p className="text-sm text-ink/60">Palpites ativos, desempenho e movimentações de pontos.</p>
      </div>
      <PortfolioPanel initial={initial} />
    </main>
  );
}
