import { requireUser } from "@/lib/session";
import { getCategories, getUserPointsInfo } from "@/lib/queries";
import ProposalForm from "@/components/ProposalForm";
import {
  getUserLevel,
  getUserLevelInfo,
  canPropose,
  proposalDisabledReason,
  PROPOSAL_LEVEL_REQUIREMENT,
  PROPOSAL_POINTS_REQUIREMENT,
} from "@/lib/points";

const FALLBACK_CATEGORIES = [
  "Política",
  "Esportes",
  "Cripto",
  "Economia",
  "Entretenimento",
  "Tecnologia",
  "Outros",
];

export default async function ProposePage() {
  const user = await requireUser();
  const dbCategories = await getCategories();
  const categories = dbCategories.length > 0 ? dbCategories : FALLBACK_CATEGORIES;
  const info = await getUserPointsInfo(user.id);

  if (!info) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <p className="text-sm text-rose-600">Não foi possível carregar os dados do seu usuário.</p>
      </main>
    );
  }

  const level = getUserLevel(info.totalGranted);
  const levelInfo = getUserLevelInfo(info.totalGranted);
  const eligible = canPropose(info.totalGranted);
  const disabledReason = proposalDisabledReason(info.totalGranted);

  const pointsProgress = Math.min(1, info.totalGranted / PROPOSAL_POINTS_REQUIREMENT);
  const levelProgress = Math.min(1, level / PROPOSAL_LEVEL_REQUIREMENT);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Sugerir pergunta</h1>
        <p className="mt-1 text-sm text-ink/60">
          Sugira uma pergunta de A favor ou Contra. Um administrador revisa e publica se aprovada.
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-mist bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink/80">Seu progresso</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-ink/50">Nível</span>
            <span className="float-right font-medium text-ink">
              {level} {level === 1 ? "°" : "º"}
            </span>
          </div>
          <div>
            <span className="text-ink/50">Pontos concedidos (vida)</span>
            <span className="float-right font-medium text-ink">{info.totalGranted.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-ink/50">Pontos disponíveis</span>
            <span className="float-right font-medium text-ink">{info.balance.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-ink/50">Nível para liberar sugestões</span>
            <span className="float-right font-medium text-signal">{PROPOSAL_LEVEL_REQUIREMENT}º</span>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-ink/60">
            <span>
              {PROPOSAL_POINTS_REQUIREMENT} pontos concedidos para sugerir
            </span>
            <span>{Math.round(pointsProgress * 100)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-mist">
            <div
              className={`h-2 rounded-full ${pointsProgress >= 1 ? "bg-signal" : "bg-market-amber"}`}
              style={{ width: `${pointsProgress * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-ink/60">
            <span>Nível {PROPOSAL_LEVEL_REQUIREMENT} (cada {5000} pontos = 1 nível)</span>
            <span>Nível {level}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-mist">
            <div
              className={`h-2 rounded-full ${levelProgress >= 1 ? "bg-signal" : "bg-market-amber"}`}
              style={{ width: `${levelProgress * 100}%` }}
            />
          </div>
        </div>

        {levelInfo.progressToNext > 0 && (
          <p className="mt-2 text-xs text-ink/50">
            Faltam {levelInfo.nextLevelAt - info.totalGranted} pontos para o próximo nível.
          </p>
        )}
      </div>

      {eligible ? (
        <ProposalForm categories={categories} />
      ) : (
        <ProposalForm categories={categories} disabled lockMessage={disabledReason ?? undefined} />
      )}
    </main>
  );
}
