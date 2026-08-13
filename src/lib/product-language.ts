export const SIDE_LABEL = { YES: "A favor", NO: "Contra" } as const;
export const DIRECTION_LABEL = { BUY: "Adicionar", SELL: "Reduzir" } as const;

export const ORDER_TYPE_LABEL: Record<string, string> = {
  GTC: "Manter pendente",
  FAK: "Somente agora",
  FOK: "Confirmar por completo",
};

export const QUESTION_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aceitando palpites",
  CLOSED: "Encerrada",
  RESOLVED_YES: "Resultado definido (A favor)",
  RESOLVED_NO: "Resultado definido (Contra)",
  VOID: "Anulada",
};

export const ORDER_STATUS_MESSAGE: Record<string, string> = {
  FILLED: "Palpite confirmado por completo.",
  PARTIAL: "Palpite confirmado parcialmente.",
  CANCELED: "O palpite não pôde ser confirmado agora.",
  OPEN: "Palpite pendente aguardando confirmação.",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aguardando confirmação",
  PARTIAL: "Confirmado parcialmente",
  FILLED: "Confirmado",
  CANCELED: "Cancelado",
};

export const TRADE_KIND_LABEL: Record<string, string> = {
  MINT: "Novas unidades",
  MERGE: "Unidades reduzidas",
  TRANSFER: "Unidades redistribuídas",
};

export const LEDGER_LABEL: Record<string, string> = {
  SIGNUP_GRANT: "Pontos de cadastro",
  DAILY_BONUS: "Pontos diários",
  ORDER_ESCROW: "Reserva",
  ORDER_RELEASE: "Liberação",
  TRADE_SETTLE: "Palpite confirmado",
  RESOLUTION_PAYOUT: "Pontos pelo resultado",
  ADMIN_ADJUST: "Ajuste administrativo",
};

export const POINTS_DISCLAIMER =
  "Pontos gratuitos e virtuais, sem valor monetário. Não podem ser comprados, vendidos, transferidos, resgatados ou convertidos em dinheiro, cripto, bens, descontos, créditos ou serviços.";

export function publicEngineErrorMessage(message: string): string {
  if (message.includes("Feche o mercado")) return "Encerre os palpites antes de definir o resultado.";
  if (message.includes("já resolvido")) return "O resultado desta pergunta já foi definido.";
  if (message.includes("não encontrado") && message.toLowerCase().includes("mercado")) return "Pergunta não encontrada.";
  if (message.includes("não está aberto") || message.includes("fechado")) return "Esta pergunta não está aceitando palpites.";
  if (message.includes("Pontos insuficientes")) return "Você não tem pontos disponíveis suficientes.";
  if (message.includes("Cotas insuficientes") || message.includes("Saldo insuficiente de cotas")) {
    return "Você não tem unidades suficientes para reduzir este palpite.";
  }
  if (message.includes("Preço")) return "A chance deve ser um número inteiro entre 1 e 99.";
  if (message.includes("Ordem não encontrada")) return "Palpite pendente não encontrado.";
  if (message.includes("ordem de outro usuário")) return "Você não pode cancelar o palpite pendente de outra pessoa.";
  return "Não foi possível concluir a ação.";
}
