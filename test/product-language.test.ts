import { describe, expect, it } from "vitest";
import {
  DIRECTION_LABEL,
  LEDGER_LABEL,
  ORDER_STATUS_MESSAGE,
  ORDER_TYPE_LABEL,
  QUESTION_STATUS_LABEL,
  SIDE_LABEL,
  TRADE_KIND_LABEL,
  publicEngineErrorMessage,
} from "@/lib/product-language";

describe("linguagem pública da Owla", () => {
  it("apresenta escolhas e ações sem vocabulário de compra e venda", () => {
    expect(SIDE_LABEL).toEqual({ YES: "A favor", NO: "Contra" });
    expect(DIRECTION_LABEL).toEqual({ BUY: "Adicionar", SELL: "Reduzir" });
    expect(ORDER_TYPE_LABEL).toEqual({
      GTC: "Manter pendente",
      FAK: "Somente agora",
      FOK: "Confirmar por completo",
    });
  });

  it("explica os estados de uma pergunta e de um palpite", () => {
    expect(QUESTION_STATUS_LABEL).toEqual({
      OPEN: "Aceitando palpites",
      CLOSED: "Encerrada",
      RESOLVED_YES: "Resultado definido (A favor)",
      RESOLVED_NO: "Resultado definido (Contra)",
      VOID: "Anulada",
    });
    expect(ORDER_STATUS_MESSAGE).toEqual({
      FILLED: "Palpite confirmado por completo.",
      PARTIAL: "Palpite confirmado parcialmente.",
      CANCELED: "O palpite não pôde ser confirmado agora.",
      OPEN: "Palpite pendente aguardando confirmação.",
    });
  });

  it("descreve combinações e movimentações de pontos com termos neutros", () => {
    expect(TRADE_KIND_LABEL).toEqual({
      MINT: "Novas unidades",
      MERGE: "Unidades reduzidas",
      TRANSFER: "Unidades redistribuídas",
    });
    expect(LEDGER_LABEL).toEqual({
      SIGNUP_GRANT: "Pontos de cadastro",
      DAILY_BONUS: "Pontos diários",
      ORDER_ESCROW: "Reserva",
      ORDER_RELEASE: "Liberação",
      TRADE_SETTLE: "Palpite confirmado",
      RESOLUTION_PAYOUT: "Pontos pelo resultado",
      ADMIN_ADJUST: "Ajuste administrativo",
    });
  });

  it("traduz erros internos antes de mostrá-los ao usuário", () => {
    const cases = [
      ["Mercado não encontrado", "Pergunta não encontrada."],
      ["Mercado não está aberto para negociação", "Esta pergunta não está aceitando palpites."],
      ["Feche o mercado antes de resolver", "Encerre os palpites antes de definir o resultado."],
      ["Mercado já resolvido", "O resultado desta pergunta já foi definido."],
      ["Pontos insuficientes para a compra", "Você não tem pontos disponíveis suficientes."],
      ["Cotas insuficientes para vender", "Você não tem unidades suficientes para reduzir este palpite."],
      ["Saldo insuficiente de cotas para vender", "Você não tem unidades suficientes para reduzir este palpite."],
      ["Preço deve ser um inteiro entre 1 e 99", "A chance deve ser um número inteiro entre 1 e 99."],
      ["Ordem não encontrada", "Palpite pendente não encontrado."],
      [
        "Não é possível cancelar a ordem de outro usuário",
        "Você não pode cancelar o palpite pendente de outra pessoa.",
      ],
    ] as const;

    for (const [internal, expected] of cases) {
      expect(publicEngineErrorMessage(internal)).toBe(expected);
    }
    expect(publicEngineErrorMessage("falha desconhecida")).toBe("Não foi possível concluir a ação.");
  });
});
