-- Human in the Loop (HITL) validation gates
-- ============================================

-- Add 'awaiting_approval' to the stage_status enum
alter type stage_status add value 'awaiting_approval';

-- HITL configuration table (global setting, single row)
create table public.hitl_config (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  gate_after_ideation boolean not null default true,
  gate_after_planning boolean not null default true,
  gate_after_development boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

-- Insert default row (HITL disabled, all gates on by default)
insert into public.hitl_config (enabled, gate_after_ideation, gate_after_planning, gate_after_development)
values (false, true, true, true);

-- RLS
alter table public.hitl_config enable row level security;

-- Anon can read (dashboard needs to see config)
create policy "anon_read_hitl_config" on public.hitl_config for select using (true);
