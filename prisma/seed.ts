import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { grantSignup } from "../src/lib/points";
import { hashPassword } from "../src/lib/password";

const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin123-local";
const SEED_ALICE_PASSWORD = process.env.SEED_ALICE_PASSWORD ?? "alice123-local";
const SEED_BOB_PASSWORD = process.env.SEED_BOB_PASSWORD ?? "bob12345-local";

const randPrice = () => 40 + Math.floor(Math.random() * 26);

const EVENTS: Array<{
  slug: string;
  title: string;
  description: string;
  category: string;
  days: number;
  markets: Array<{ question: string; rulesText: string }>;
}> = [
  {
    slug: "copa-2026-brasil-campeao",
    title: "Brasil é campeão da Copa do Mundo 2026?",
    description: "A Seleção Brasileira levanta a taça no Mundial da FIFA 2026.",
    category: "Política",
    days: 45,
    markets: [
      { question: "O Brasil vence a Copa do Mundo 2026?", rulesText: "Sim se a Seleção for campeã do torneio." },
      { question: "O Brasil chega à final da Copa do Mundo 2026?", rulesText: "Sim se o Brasil jogar a final." },
    ],
  },
  {
    slug: "reforma-tributaria-alimentos-2027",
    title: "A reforma tributária reduzirá impostos sobre alimentos até 2027?",
    description: "Cesta básica com alíquota reduzida após a transição da reforma.",
    category: "Política",
    days: 150,
    markets: [
      { question: "Alimentos terão imposto menor até 2027?", rulesText: "Sim se houver redução efetiva de alíquota sobre alimentos." },
    ],
  },
  {
    slug: "eleicoes-2026-segundo-turno",
    title: "Haverá segundo turno nas eleições presidenciais de 2026?",
    description: "Disputa presidencial brasileira vai para o 2º turno.",
    category: "Política",
    days: 90,
    markets: [
      { question: "Eleição presidencial de 2026 terá 2º turno?", rulesText: "Sim se nenhum candidato vencer em 1º turno." },
      { question: "A candidata ou o candidato vencedor será de um partido novo (fundado após 2018)?", rulesText: "Sim se o partido vencedor foi fundado após 2018." },
    ],
  },
  {
    slug: "flamengo-brasileirao-2026",
    title: "Flamengo ganha o Brasileirão 2026?",
    description: "O Mengão conquista o Campeonato Brasileiro de futebol.",
    category: "Esportes",
    days: 120,
    markets: [
      { question: "O Flamengo é campeão do Brasileirão 2026?", rulesText: "Sim se o Flamengo terminar em 1º." },
      { question: "O Flamengo termina entre os 4 primeiros?", rulesText: "Sim se terminar entre o 1º e o 4º lugar." },
    ],
  },
  {
    slug: "botafogo-final-libertadores-2026",
    title: "Botafogo chega à final da Libertadores 2026?",
    description: "O Fogão repete a campanha e disputa a decisão da América.",
    category: "Esportes",
    days: 110,
    markets: [
      { question: "O Botafogo chega à final da Libertadores 2026?", rulesText: "Sim se o Botafogo disputar a final." },
    ],
  },
  {
    slug: "brasil-medalha-futebol-olimpico-2028",
    title: "O Brasil garante vaga no futebol olímpico de 2028?",
    description: "A seleção olímpica se classifica para os Jogos de Los Angeles.",
    category: "Esportes",
    days: 100,
    markets: [
      { question: "O Brasil se classifica para o futebol olímpico 2028?", rulesText: "Sim se houver classificação garantida até o fim de 2026." },
    ],
  },
  {
    slug: "bitcoin-120k-2026",
    title: "Bitcoin fecha 2026 acima de US$ 120 mil?",
    description: "O BTC encerra o ano acima da marca dos US$ 120 mil.",
    category: "Cripto",
    days: 140,
    markets: [
      { question: "O Bitcoin fecha 2026 acima de US$ 120 mil?", rulesText: "Sim se o preço ao fim de 2026 for superior a US$ 120.000." },
      { question: "O Bitcoin atinge US$ 150 mil em algum momento de 2026?", rulesText: "Sim se o BTC tocar US$ 150 mil intraday até 31/12/2026." },
    ],
  },
  {
    slug: "ethereum-8k-2026",
    title: "Ethereum fecha 2026 acima de US$ 8 mil?",
    description: "O ETH encerra o ano acima da marca dos US$ 8 mil.",
    category: "Cripto",
    days: 140,
    markets: [
      { question: "O Ethereum fecha 2026 acima de US$ 8 mil?", rulesText: "Sim se o preço ao fim de 2026 for superior a US$ 8.000." },
    ],
  },
  {
    slug: "stablecoin-regulada-brasil-2027",
    title: "Stablecoins terão marco regulatório no Brasil até 2027?",
    description: "Regulação específica para stablecoins entra em vigor no país.",
    category: "Cripto",
    days: 160,
    markets: [
      { question: "O BC regulamenta stablecoins até 2027?", rulesText: "Sim se houver regra em vigor até 31/12/2027." },
    ],
  },
  {
    slug: "selic-2026-abaixo-10",
    title: "Selic termina 2026 abaixo de 10%?",
    description: "A taxa básica de juros brasileira cai para menos de 10% a.a.",
    category: "Economia",
    days: 140,
    markets: [
      { question: "A Selic fecha 2026 abaixo de 10%?", rulesText: "Sim se a meta Selic na última reunião de 2026 for menor que 10%." },
    ],
  },
  {
    slug: "ipca-2026-abaixo-45",
    title: "IPCA 2026 fica abaixo de 4,5%?",
    description: "A inflação brasileira do ano fica abaixo da meta.",
    category: "Economia",
    days: 140,
    markets: [
      { question: "O IPCA de 2026 fica abaixo de 4,5%?", rulesText: "Sim se a inflação acumulada do ano for menor que 4,5%." },
    ],
  },
  {
    slug: "pib-2026-acima-25",
    title: "O PIB brasileiro cresce mais de 2,5% em 2026?",
    description: "A economia brasileira acelera acima do consenso.",
    category: "Economia",
    days: 150,
    markets: [
      { question: "O PIB de 2026 cresce mais de 2,5%?", rulesText: "Sim se o crescimento anual ficar acima de 2,5%." },
    ],
  },
  {
    slug: "filme-brasileiro-oscar-2027",
    title: "Um filme brasileiro ganha o Oscar 2027?",
    description: "Produção nacional leva estatueta na premiação de Hollywood.",
    category: "Entretenimento",
    days: 170,
    markets: [
      { question: "O Brasil vence uma categoria no Oscar 2027?", rulesText: "Sim se qualquer filme brasileiro levar um Oscar em 2027." },
    ],
  },
  {
    slug: "taylor-swift-brasil-2026",
    title: "Taylor Swift faz show no Brasil em 2026?",
    description: "A cantora anuncia e realiza apresentações no país este ano.",
    category: "Entretenimento",
    days: 90,
    markets: [
      { question: "Taylor Swift se apresenta no Brasil em 2026?", rulesText: "Sim se houver ao menos um show realizado no país em 2026." },
    ],
  },
  {
    slug: "novela-das-9-record-2026",
    title: "A novela das 9 bate recorde de audiência até o fim de 2026?",
    description: "A trama do horário nobre supera a média da faixa.",
    category: "Entretenimento",
    days: 100,
    markets: [
      { question: "A novela das 9 registra recorde de audiência em 2026?", rulesText: "Sim se algum capítulo bater o recorde do ano." },
    ],
  },
  {
    slug: "5g-todas-capitais-2027",
    title: "O Brasil terá 5G pleno em todas as capitais até 2027?",
    description: "Cobertura 5G completa nas 27 capitais brasileiras.",
    category: "Tecnologia",
    days: 180,
    markets: [
      { question: "Todas as capitais terão 5G pleno até 2027?", rulesText: "Sim se as 27 capitais tiverem cobertura 5G até 31/12/2027." },
    ],
  },
  {
    slug: "openai-ipo-2026",
    title: "A OpenAI abre capital (IPO) até o fim de 2026?",
    description: "A empresa de IA lista suas ações em bolsa este ano.",
    category: "Tecnologia",
    days: 130,
    markets: [
      { question: "A OpenAI faz IPO até o fim de 2026?", rulesText: "Sim se houver listagem oficial em bolsa até 31/12/2026." },
    ],
  },
  {
    slug: "starlink-brasil-5g-2027",
    title: "A Starlink expande cobertura rural no Brasil até 2027?",
    description: "Internet via satélite cobre novas regiões rurais do país.",
    category: "Tecnologia",
    days: 175,
    markets: [
      { question: "A Starlink amplia cobertura rural no Brasil até 2027?", rulesText: "Sim se houver expansão oficial de cobertura até 31/12/2027." },
    ],
  },
];

async function upsertUser(data: {
  email: string;
  password: string;
  name: string;
  role?: "ADMIN" | "USER";
}): Promise<{ id: string; totalGranted: number }> {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: await hashPassword(data.password),
      name: data.name,
      role: data.role ?? "USER",
    },
  });
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Seed de demonstração é proibido em produção (NODE_ENV=production).");
  }

  // Fora de produção, exigimos senhas com sufixo "-local" para evitar que um
  // valor padrão/real vaze para um ambiente compartilhado por engano.
  const seedPasswords = [SEED_ADMIN_PASSWORD, SEED_ALICE_PASSWORD, SEED_BOB_PASSWORD];
  for (const pwd of seedPasswords) {
    if (!pwd.endsWith("-local")) {
      throw new Error(
        "Seed de demonstração exige senhas com sufixo '-local' (ex: admin123-local). " +
          "Defina SEED_ADMIN_PASSWORD, SEED_ALICE_PASSWORD e SEED_BOB_PASSWORD no .env.",
      );
    }
  }

  const admin = await upsertUser({ email: "admin@owla.local", password: SEED_ADMIN_PASSWORD, name: "Admin", role: "ADMIN" });
  const alice = await upsertUser({ email: "alice@owla.local", password: SEED_ALICE_PASSWORD, name: "Alice" });
  const bob = await upsertUser({ email: "bob@owla.local", password: SEED_BOB_PASSWORD, name: "Bob" });

  for (const user of [admin, alice, bob]) {
    if (user.totalGranted === 0) {
      await grantSignup(user.id);
      console.log(`seed: grantSignup para ${user.id}`);
    }
  }

  let eventsCreated = 0;
  let marketsCreated = 0;

  for (const ev of EVENTS) {
    const existingEvent = await prisma.event.findUnique({ where: { slug: ev.slug } });
    let eventId: string;
    if (existingEvent) {
      eventId = existingEvent.id;
    } else {
      const created = await prisma.event.create({
        data: {
          slug: ev.slug,
          title: ev.title,
          description: ev.description,
          category: ev.category,
          imageUrl: null,
          endsAt: new Date(Date.now() + ev.days * 86_400_000),
          status: "OPEN",
        },
      });
      eventId = created.id;
      eventsCreated += 1;
    }

    for (const m of ev.markets) {
      const existing = await prisma.market.findFirst({
        where: { eventId, question: m.question },
      });
      if (existing) continue;
      await prisma.market.create({
        data: {
          eventId,
          question: m.question,
          rulesText: m.rulesText,
          status: "OPEN",
          lastPrice: randPrice(),
          volume: 0,
          pairs: 0,
        },
      });
      marketsCreated += 1;
    }
  }

  console.log(`seed concluído: ${eventsCreated} eventos, ${marketsCreated} mercados.`);
}

main()
  .catch((err) => {
    console.error("seed falhou:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
