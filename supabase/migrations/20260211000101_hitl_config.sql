-- Human in the Loop (HITL) validation gates
-- ============================================

-- Add 'awaiting_approval' to the stage_status enum (idempotent)
do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'awaiting_approval' and enumtypid = 'stage_status'::regtype) then
    alter type stage_status add value 'awaiting_approval';
  end if;
end $$;

-- HITL configuration table (global setting, single row)
create table if not exists public.hitl_config (
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
select false, true, true, true
where not exists (select 1 from public.hitl_config);

-- RLS
alter table public.hitl_config enable row level security;

-- Anon can read (dashboard needs to see config)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'anon_read_hitl_config' and tablename = 'hitl_config') then
    create policy "anon_read_hitl_config" on public.hitl_config for select using (true);
  end if;
end $$;
