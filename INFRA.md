# Shipyfus Engine — Infrastructure Guide

How the codebase is structured and what to touch when you want to change things.

## Architecture Overview

```
shipyfus-engine/
├── apps/
│   ├── backend/          # Express API + pipeline orchestrator
│   │   └── src/
│   │       ├── agents/   # AI agent prompts (one per stage)
│   │       ├── orchestrator/  # Pipeline engine
│   │       ├── routes/   # REST API endpoints
│   │       ├── services/ # Supabase DB, approvals, etc.
│   │       └── middleware/    # Auth, error handling
│   ├── frontend/         # React + Vite dashboard
│   │   └── src/
│   │       ├── pages/    # Route pages
│   │       ├── components/   # Reusable UI
│   │       ├── hooks/    # React hooks (auth, etc.)
│   │       └── lib/      # API client, auth helpers
│   └── landing/          # Public landing page (unused for now)
├── packages/             # Shared TypeScript packages
│   ├── shared/           # Types, constants, schemas
│   ├── idea/             # Ideation stage logic
│   ├── brand/            # Branding + domain purchase
│   ├── planning/         # Planning stage logic
│   ├── research/         # Market research
│   ├── social/           # Twitter posting
│   ├── approval/         # HITL approval system
│   ├── templates/        # [SHIPYFUS] 6 project templates
│   ├── testing/          # [SHIPYFUS] TDD test generation
│   ├── analytics/        # [SHIPYFUS] PostHog + feedback widget
│   └── learnings/        # [SHIPYFUS] Learning loop
├── products/             # Built products go here (git-ignored)
├── supabase/
│   ├── migrations/       # SQL migrations (applied in order)
│   └── seed.sql          # Default data
└── ecosystem.config.cjs  # PM2 config for backend process
```

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 19 + Vite 7 + Tailwind 4 | Deployed to Vercel |
| Backend | Express 5 + TypeScript | Runs on VPS via PM2 |
| Database | Supabase (PostgreSQL) | Cloud hosted, realtime |
| Build agents | Claude Code CLI | Each stage spawns a Claude session |
| Deploy | Vercel | Auto-deploy via API |
| Domains | Porkbun | Optional domain purchase |
| Analytics | PostHog | Auto-injected into builds |
| Feedback | Custom widget | feedback.shipyfus.xyz |
| Monorepo | Turborepo + pnpm | Workspace packages |

## Pipeline Stages

The pipeline is defined in `apps/backend/src/orchestrator/stages.ts`:

```
research → ideation → branding → planning → testing → development → deployment → distribution
```

Each stage:
1. Has a **prompt** in `apps/backend/src/agents/prompts/`
2. Has a **mode**: `oneshot` (runs once) or `loop` (repeats until exit criteria)
3. Can have a **HITL gate** (human approval between stages)
4. Passes output to the next stage via `input_context` / `output_context` in Supabase

## How to Change Things

### "I want to change what kind of ideas get generated"

**File:** `packages/idea/src/prompts.ts`
- This is the ideation prompt that generates the PRD
- Modify the system prompt to change what kinds of products get built
- The scoring formula is also here (viral x 2 + execution + distribution + moat)

**File:** `apps/backend/src/agents/prompts/researcher.ts`
- Change what the researcher looks for (competitors, market analysis)
- Moat scoring framework is defined here

**Also:** Constraints in the dashboard (Ideation section) let you set platform, audience, complexity without code changes.

### "I want to add a new template"

1. Create a GitHub repo: `franacc12312/shipyfus-template-<name>`
2. Edit `packages/templates/src/index.ts`:
   - Add to the `TEMPLATES` array with name, repo, description, bestFor keywords, complexity, techStack
3. Run `pnpm install && pnpm run build`
4. The ideator will auto-recommend it when keywords match

### "I want to change how tests are generated"

**File:** `packages/testing/src/index.ts`
- `generateTestPlanPrompt()` — the prompt that creates test files from PRD
- `generateProgressCheckPrompt()` — checks which tests pass

**File:** `apps/backend/src/agents/prompts/tester.ts`
- The full testing stage prompt
- Change test frameworks, coverage requirements, etc.

### "I want to change how products are built"

**File:** `apps/backend/src/agents/prompts/developer.ts`
- The development loop prompt
- TDD instructions, PROGRESS.md tracking, feedback widget injection
- This is the most critical prompt: it controls what Claude Code actually builds

**File:** `apps/backend/src/orchestrator/pipeline.ts`
- The development stage runner (look for the `development` case)
- Controls max iterations, exit criteria, template cloning

### "I want to change deployment"

**File:** `apps/backend/src/agents/prompts/deployer.ts`
- Vercel deployment prompt
- Domain connection logic

**Also:** `VERCEL_TOKEN` in `.env` controls which Vercel account deploys to.

### "I want to change distribution channels"

**File:** `apps/backend/src/agents/prompts/herald.ts`
- Multi-channel prompt (Twitter, Reddit, HN, LinkedIn)
- Add new platforms here
- Each platform has tone/format guidelines

**File:** `packages/social/` — Twitter API integration
- To add Reddit API: create a new package or extend this one

### "I want to add a new pipeline stage"

1. **Define it** in `apps/backend/src/orchestrator/stages.ts`:
   ```ts
   mystage: { name: 'mystage', mode: 'oneshot', order: X }
   ```
2. **Create the prompt** in `apps/backend/src/agents/prompts/mystage.ts`
3. **Wire it** in `apps/backend/src/orchestrator/pipeline.ts` (add a case in the stage runner)
4. **Migration**: update the `constraints_department_check` constraint to include your stage
5. **Frontend**: add the stage to `STAGES` in `packages/shared/src/constants.ts`

### "I want to change the dashboard UI"

**Pages:** `apps/frontend/src/pages/`
- `Dashboard.tsx` — main view, run list, Ship Something button
- `RunDetail.tsx` — individual run view with stage progress
- `Constraints.tsx` — pipeline configuration
- `HitlConfig.tsx` — human-in-the-loop gate settings
- `Backlog.tsx` — idea backlog management
- `Workflow.tsx` — workflow documentation (admin only)
- `Products.tsx` — shipped products list

**Components:** `apps/frontend/src/components/`
- `ConstraintForm.tsx` — individual constraint card with tooltips + randomize
- `ScoreCard.tsx` — idea scoring display
- `MarketAnalysis.tsx` — competitor/moat display
- `Layout.tsx` — sidebar nav + auth

**Styling:** Tailwind 4, dark theme. Custom colors defined in CSS:
- `terminal-green` — primary accent
- `terminal-red`, `terminal-cyan` — status colors
- Orange (`#f97316`) — Shipyfus accent

### "I want to change HITL (approval) behavior"

**File:** `apps/frontend/src/pages/HitlConfig.tsx` — UI for configuring gates
**File:** `packages/approval/` — approval providers (dashboard + telegram)
**DB:** `hitl_config` table in Supabase

Gates are per-stage toggles. When enabled, the pipeline pauses after that stage and waits for approve/reject in the dashboard or Telegram.

## Environment Variables

```bash
# Required
SUPABASE_URL=           # Supabase project URL
SUPABASE_ANON_KEY=      # Public key (frontend)
SUPABASE_SERVICE_ROLE_KEY=  # Secret key (backend only)
ADMIN_PASSWORD=         # Dashboard login password
VERCEL_TOKEN=           # For auto-deploy

# Optional
PORKBUN_API_KEY=        # Domain purchase
PORKBUN_API_SECRET=
TAVILY_API_KEY=         # Enhanced research
TWITTER_API_KEY=        # Auto-post tweets
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_TOKEN_SECRET=
```

## Running Locally

```bash
# Install
pnpm install

# Dev mode (backend + frontend with hot reload)
pnpm run dev

# Or separately:
pnpm --filter @daio/backend dev:stable   # Backend on :3001
pnpm --filter @daio/frontend dev         # Frontend on :5173 (proxies /api to :3001)
```

## Production (VPS)

```bash
# Build everything
pnpm run build

# Backend serves frontend static files too
pm2 start ecosystem.config.cjs
pm2 logs shipyfus-backend

# Expose via Cloudflare tunnel (temporary)
~/cloudflared tunnel --url http://localhost:3001

# Or use a proper domain + nginx reverse proxy
```

## Database

Migrations are in `supabase/migrations/` and applied in alphabetical order.

To apply a new migration:
```bash
cat supabase/migrations/NEW_FILE.sql | PGPASSWORD='xxx' psql "postgresql://postgres:xxx@db.PROJECT.supabase.co:5432/postgres"
```

Key tables:
- `runs` — pipeline execution instances
- `run_stages` — each stage within a run
- `logs` — streaming agent output
- `products` — completed products
- `constraints` — per-department config
- `hitl_config` — HITL gate settings
- `backlog` — idea backlog (max 10 pending, 14-day expiry)
- `learnings` — post-ship insights for feedback loop
- `agents` — agent personas per stage

## Common Tasks

| Task | What to do |
|------|-----------|
| Change scoring formula | Edit `packages/idea/src/prompts.ts` |
| Add a topic to random pool | Edit `RANDOMIZABLE_FIELDS` in `ConstraintForm.tsx` |
| Change feedback widget look | Edit constraints > analytics (or `packages/analytics/src/index.ts`) |
| Add Reddit API posting | Create `packages/reddit/` or add to `packages/social/` |
| Change max backlog size | Edit `apps/backend/src/routes/backlog.ts` (line with `count >= 10`) |
| Change idea expiry time | Edit migration / SQL default (`interval '14 days'`) |
| Add a new nav item | Edit `Layout.tsx` NAV_ITEMS array + `App.tsx` routes |
| Deploy frontend only | `vercel --prod` from repo root |
| Restart backend | `pm2 restart shipyfus-backend` |
