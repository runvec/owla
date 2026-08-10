# Owla

Plataforma de **entretenimento com mercados de previsão** — os usuários apostam pontos (sem valor monetário) em eventos do mundo real (esportes, política, cripto, economia, entretenimento e tecnologia). É um jogo de opinião e estratégia, não uma plataforma de apostas com dinheiro real.

## Funcionalidades

- **Mercados de previsão** com livro de ofertas (order book) e gráfico de preços
- **Motor de casamento de ordens (CLOB)** — compra/venda de tokens SIM/NÃO com preço-tempo
- **Pontos sem valor monetário**: bônus de cadastro, bônus diário e níveis
- **Propostas de novos mercados** pela comunidade, com aprovação de admin
- **Portfólio** com posições, lucro/perda e histórico
- **Leaderboard** de usuários
- **Comentários** em eventos
- **Painel admin** para gerenciar eventos, mercados e propostas

## Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19, Turbopack)
- [Prisma ORM 7](https://www.prisma.io) + PostgreSQL
- [NextAuth v5](https://next-auth.js.org) (credenciais + JWT)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Vitest](https://vitest.dev) para testes
- [Zod](https://zod.dev) para validação

## 🚀 Começando (desenvolvimento local)

### Pré-requisitos

- Node.js 20+
- Docker (para o PostgreSQL local) **ou** um PostgreSQL já instalado

### 1. Suba o banco de dados

```bash
docker compose up -d
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Gere um `AUTH_SECRET` real e cole no `.env`:

```bash
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Linux/macOS
openssl rand -base64 32
```

### 3. Instale as dependências

```bash
npm install
```

### 4. Aplique as migrations e gere o client

```bash
npx prisma migrate deploy
npx prisma generate
```

### 5. (Opcional) Popule com dados de demonstração

```bash
npm run seed
```

Cria os usuários `admin@owla.local`, `alice@owla.local` e `bob@owla.local` (senhas em `.env`) e vários eventos/mercados de exemplo.

### 6. Rode o servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Testes e verificação

```bash
npm run verify
```

Executa, em ordem: typecheck → lint → testes → build de produção.

Para rodar apenas os testes:

```bash
npm test
```

## Deploy em produção

### Variáveis obrigatórias

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | URL de conexão PostgreSQL |
| `AUTH_SECRET` | Segredo para assinar os tokens JWT (obrigatório em produção) |
| `NODE_ENV` | `production` |

> **Importante**: em produção, `AUTH_SECRET` é **obrigatório** — a aplicação falha ao iniciar sem ele. Nunca rode o seed de demonstração em produção (ele é bloqueado quando `NODE_ENV=production`).

### Passos

1. Provisione um PostgreSQL gerenciado (ex: Neon, Supabase, RDS).
2. Defina `DATABASE_URL`, `AUTH_SECRET` e `NODE_ENV=production` no seu provedor de hosting.
3. Aplique as migrations: `npx prisma migrate deploy`
4. Faça o build: `npm run build`
5. Inicie: `npm run start`

O projeto é compatível com plataformas serverless (ex: Vercel) — o rate limiting é persistido no Postgres, então funciona com múltiplas instâncias.

## Estrutura

```
prisma/            Schema, migrations e seed
src/app/           Rotas (páginas e API routes)
src/components/    Componentes React
src/lib/           Lógica de negócio (engine, auth, pontos, etc.)
test/              Testes (Vitest)
```

## Documentação

- `docs/ENGINE.md` — motor de casamento de ordens (CLOB)
- `docs/PLAN.md` — modelo de negócio

## Aviso

Owla usa **pontos sem valor monetário** — é uma plataforma de entretenimento e não envolve apostas com dinheiro real. Consulte os [Termos de Uso](/terms).

