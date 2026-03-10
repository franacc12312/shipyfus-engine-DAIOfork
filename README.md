# DAIO

Autonomous product studio that builds software products end-to-end using AI agents. Give it constraints ("build me a habit tracker for developers"), and it researches the market, generates a product concept, picks a brand name, plans the architecture, writes the code, deploys to Vercel, and announces the launch — all autonomously.

A real-time dashboard lets you watch the whole thing happen.

## How It Works

DAIO runs a 7-stage pipeline, each powered by a specialized AI agent:

| Stage | Agent | What it does |
|-------|-------|-------------|
| Research | Scout | Analyzes market trends, competitors, and opportunities |
| Ideation | Nova | Generates a product requirements document (PRD) |
| Branding | Prism + Ledger | Creates brand candidates, picks a domain, buys it |
| Planning | Atlas | Converts the PRD into a structured implementation plan |
| Development | Forge | Writes the code iteratively until the product is complete |
| Deployment | Orbit | Deploys to Vercel |
| Distribution | Herald | Announces the launch on Twitter/X |

Each agent is a Claude Code CLI subprocess. The development stage uses a **ralph-loop** pattern — an orchestrator spawns Claude repeatedly, with PLAN.md and PROGRESS.md files persisting between iterations, until the product is done.

You can gate any stage with **human-in-the-loop approval** — the pipeline pauses and waits for you to approve, retry, or cancel before continuing.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` command)
- A [Supabase](https://supabase.com/) project (for the database)

## Setup

```bash
git clone https://github.com/TheDAIO/daio.git
cd daio
cp .env.example .env
```

Fill in your `.env`:

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=pick-a-password          # protects the API
OWNER_USER_ID=your-uuid                 # from Supabase auth or seed data

# Optional — stages that need these will be skipped if empty
VERCEL_TOKEN=                           # deployment stage
TAVILY_API_KEY=                         # market research stage
PORKBUN_API_KEY=                        # domain purchase
PORKBUN_API_SECRET=
TWITTER_API_KEY=                        # launch announcement
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_TOKEN_SECRET=
```

Then install and push the database schema:

```bash
pnpm install
npx supabase db push          # apply migrations
```

## Running

```bash
pnpm dev
```

This starts:
- **Backend** on `http://localhost:3001` (Express API + pipeline orchestrator)
- **Frontend** on `http://localhost:5173` (React dashboard)

## Project Structure

```
daio/
├── apps/
│   ├── backend/          # Express API + pipeline orchestrator
│   └── frontend/         # React dashboard (Vite + Tailwind)
├── packages/
│   ├── shared/           # Types, schemas, constants
│   ├── idea/             # Ideation stage logic
│   ├── planning/         # Planning stage logic
│   ├── research/         # Market research (Tavily)
│   ├── brand/            # Domain checking + purchase (Porkbun)
│   └── pipeline-core/    # Shared pipeline utilities
└── supabase/             # Migrations and seed data
```

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Express 5, TypeScript, Zod
- **Database**: Supabase (Postgres + Realtime)
- **Agents**: Claude Code CLI (`--print --output-format stream-json`)

## Tests

```bash
pnpm test
```

## License

MIT
