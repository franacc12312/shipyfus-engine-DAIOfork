-- DAIO Autonomous Product Studio - Initial Schema
-- ================================================

-- Users (simple for V1 - just owner)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text not null default 'viewer' check (role in ('owner', 'viewer')),
  created_at timestamptz not null default now()
);

-- Constraints (per-department configuration)
create table public.constraints (
  id uuid primary key default gen_random_uuid(),
  department text not null unique check (department in ('ideation', 'planning', 'development', 'deployment')),
  config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

-- Run status enum
create type run_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');

-- Runs (pipeline execution instances)
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  status run_status not null default 'queued',
  triggered_by uuid references public.users(id),
  idea_summary text,
  product_id uuid,
  deploy_url text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb default '{}'
);

-- Stage status enum
create type stage_status as enum ('pending', 'running', 'completed', 'failed', 'skipped');

-- Run stages (each stage within a run)
create table public.run_stages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  stage text not null,
  status stage_status not null default 'pending',
  iteration int not null default 0,
  agent_session_id text,
  input_context jsonb,
  output_context jsonb,
  cost_usd numeric(10,6) default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_run_stages_run_id on public.run_stages(run_id);

-- Logs (streaming agent output - high write volume)
create table public.logs (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.runs(id) on delete cascade,
  stage text not null,
  iteration int not null default 0,
  event_type text not null,
  content text,
  raw_event jsonb,
  timestamp timestamptz not null default now()
);

create index idx_logs_run_id on public.logs(run_id);
create index idx_logs_run_stage on public.logs(run_id, stage);

-- Products (completed products registry)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  run_id uuid unique references public.runs(id),
  name text not null,
  description text,
  idea_spec jsonb,
  plan text,
  tech_stack jsonb,
  directory_path text not null,
  deploy_url text,
  status text not null default 'built' check (status in ('built', 'tested', 'deployed', 'archived')),
  created_at timestamptz not null default now()
);

-- Enable Realtime on tables the frontend needs
alter publication supabase_realtime add table public.runs;
alter publication supabase_realtime add table public.run_stages;
alter publication supabase_realtime add table public.logs;

-- Row Level Security
alter table public.users enable row level security;
alter table public.constraints enable row level security;
alter table public.runs enable row level security;
alter table public.run_stages enable row level security;
alter table public.logs enable row level security;
alter table public.products enable row level security;

-- Anon can read everything (dashboard is public read-only)
create policy "anon_read_users" on public.users for select using (true);
create policy "anon_read_constraints" on public.constraints for select using (true);
create policy "anon_read_runs" on public.runs for select using (true);
create policy "anon_read_run_stages" on public.run_stages for select using (true);
create policy "anon_read_logs" on public.logs for select using (true);
create policy "anon_read_products" on public.products for select using (true);
