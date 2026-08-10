import LeaderboardTable from "@/components/LeaderboardTable";

export default function LeaderboardPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Ranking</h1>
        <p className="text-sm text-ink/60">Quem está lucrando mais em pontos com suas previsões.</p>
      </div>
      <LeaderboardTable />
    </main>
  );
}