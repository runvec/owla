# Owla

**Perguntas sobre o futuro. Palpites com pontos.** A Owla é uma plataforma de entretenimento na qual pessoas usam pontos gratuitos e virtuais para se posicionar A favor ou Contra acontecimentos do mundo real. Os pontos não têm valor monetário, não podem ser comprados ou vendidos e nunca são convertidos em dinheiro, cripto, bens, descontos, créditos ou serviços.

## Funcionalidades

- **Perguntas** com palpites A favor/Contra, painel de palpites em aberto e evolução da chance
- **Combinação real entre participantes** preservada por um motor CLOB interno
- **Pontos gratuitos e virtuais**: pontos de cadastro, pontos diários e níveis
- **Sugestões de novas perguntas** pela comunidade, com aprovação de admin
- **Meus palpites** com palpites ativos, desempenho e histórico
- **Ranking** de desempenho e participação
- **Comentários** em eventos
- **Painel admin** para gerenciar eventos, perguntas e sugestões

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
