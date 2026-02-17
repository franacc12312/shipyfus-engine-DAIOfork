# DAIO - Autonomous Product Studio

## Overview
DAIO is an autonomous product studio that generates and builds software products end-to-end using AI agents. A web dashboard shows the entire 4-stage pipeline in real-time: ideation, planning, development (ralph-loop), and deployment.

## Quick Start
```bash
pnpm install
pnpm dev          # Starts backend (port 3001) + frontend (port 5173)
pnpm test         # Runs all tests across workspace
```

## Architecture
- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend**: Vite + React 19 + Tailwind CSS v4 (dark terminal theme)
- **Backend**: Express 5 + TypeScript
- **Database**: Supabase (hosted) — Postgres + Realtime subscriptions
- **Agents**: Claude Code CLI subprocesses (`--print --output-format stream-json`)
- **Development loop**: Ralph-loop pattern (orchestrator spawns Claude repeatedly, files persist)

## Project Structure
```
daio/
├── packages/shared/     # @daio/shared — types, constants, Zod schemas
├── apps/backend/        # @daio/backend — Express API + pipeline orchestrator
│   └── src/
│       ├── agents/      # AgentRunner (runOnce/runLoop) + prompts
│       ├── orchestrator/ # PipelineOrchestrator + stage definitions
│       ├── routes/      # health, constraints, runs, products
│       ├── middleware/   # auth (admin password), errors
│       └── services/    # Supabase client
├── apps/frontend/       # @daio/frontend — React dashboard
│   └── src/
│       ├── components/  # Layout, LogStream, StageIndicator, etc.
│       ├── hooks/       # useRealtimeLogs, useRealtimeRun, useAuth
│       ├── pages/       # Dashboard, RunDetail, Constraints, Products
│       └── lib/         # supabase, api, auth
├── products/            # Built products output directory
└── supabase/            # Migrations and seed data
```

## Key Files
- `apps/backend/src/agents/runner.ts` — AgentRunner with two modes: runOnce (one-shot) and runLoop (ralph-loop)
- `apps/backend/src/orchestrator/pipeline.ts` — PipelineOrchestrator sequences 4 stages
- `apps/backend/src/agents/prompts/` — Prompt builders for each stage
- `apps/frontend/src/components/LogStream.tsx` — Terminal-style log viewer
- `apps/frontend/src/hooks/useRealtimeLogs.ts` — Live log streaming via Supabase Realtime

## Database
Hosted Supabase (project ref: yxwkvbvbugknxdrvpzlq). Tables: users, constraints, runs, run_stages, logs, products. Realtime enabled on runs, run_stages, logs.

**ALWAYS use the Supabase CLI** (`supabase` / `npx supabase`) for all database operations — migrations, schema changes, seeding, branching, etc. NEVER run SQL manually in the Supabase dashboard console. Everything must be automated and reproducible via CLI so that no human intervention is required. If a database operation can't be done through the CLI, find a way to script it.

## Pipeline
1. **Ideation** (one-shot): Generates PRD from constraints
2. **Planning** (one-shot): Converts PRD to structured PLAN.md
3. **Development** (ralph-loop): Executes plan iteratively until `<promise>PRODUCT COMPLETE</promise>`
4. **Deployment** (one-shot): Deploys to Vercel

## Environment Variables
See `.env.example` for all required variables. Key ones: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD, OWNER_USER_ID, VERCEL_TOKEN.

## Worktree Policy

**ALWAYS work in a git worktree** (`.worktrees/` directory), never directly on `main`. Each task/issue should have its own worktree. If context has been lost and you're unsure which worktree to use, try to infer it from the current task or Linear issue — if you can't, ask the user. Do not make changes on `main` unless the user explicitly tells you to.

## Port Management

Each worktree gets its own backend + frontend ports to avoid clashes when running multiple worktrees simultaneously.

- **Port registry**: `.worktrees/ports.json` — maps worktree names to `{ backend, frontend }` port pairs
- **Main is always reserved**: backend 3001, frontend 5173 — never deallocated
- **Allocation**: `/create_worktree` assigns the next available ports and updates the worktree's `.env`
- **Deallocation**: `/cleanup_worktree` removes the entry from the registry
- Ports are read from `.env` by both backend (`PORT`) and frontend (`FRONTEND_PORT` + proxy to `PORT`)
- When running `pnpm dev` in a worktree, servers start on the ports specified in that worktree's `.env`

## Conventions
- TypeScript everywhere, ESM modules
- Zod for runtime validation
- Express 5 with async route handlers
- Supabase service_role for backend writes, anon key for frontend reads
- Dark terminal aesthetic (zinc-950 backgrounds, green/cyan accents, monospace fonts)

## Linear Integration

- **Workspace**: fioris
- **Team**: DAIO
- **Project URL**: https://linear.app/fioris/team/DAI/active
- **Issue Identifier**: DAI

