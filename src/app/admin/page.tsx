import { requireAdmin } from "@/lib/session";
import { getAdminStats, getPendingProposals, getCategories } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import AdminPanel from "@/components/AdminPanel";

export default async function AdminPage() {
  await requireAdmin();

  const [stats, pending, markets, categories] = await Promise.all([
    getAdminStats(),
    getPendingProposals(),
    prisma.market.findMany({ include: { event: true }, orderBy: { createdAt: "desc" } }),
    getCategories(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Painel do administrador</h1>
        <p className="text-sm text-ink/60">Resumo, propostas e gestão de mercados.</p>
      </div>
      <AdminPanel
        initialStats={stats}
        initialPending={pending}
        initialMarkets={markets}
        categories={categories.length > 0 ? categories : undefined}
      />
    </main>
  );
}