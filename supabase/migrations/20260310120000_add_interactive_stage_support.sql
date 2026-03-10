-- Add interactive stage support without breaking existing approval gates.

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumlabel = 'awaiting_input'
      and enumtypid = 'stage_status'::regtype
  ) then
    alter type stage_status add value 'awaiting_input';
  end if;
end $$;

alter table public.hitl_config
  add column if not exists gate_after_research boolean not null default true,
  add column if not exists gate_after_ideation boolean not null default true,
  add column if not exists gate_after_branding boolean not null default true,
  add column if not exists gate_after_planning boolean not null default true,
  add column if not exists gate_after_development boolean not null default true,
  add column if not exists gate_after_deployment boolean not null default false,
  add column if not exists research_mode text,
  add column if not exists ideation_mode text,
  add column if not exists branding_mode text,
  add column if not exists planning_mode text,
  add column if not exists development_mode text,
  add column if not exists deployment_mode text;

update public.hitl_config
set
  research_mode = coalesce(research_mode, case when gate_after_research then 'approval' else 'automatic' end),
  ideation_mode = coalesce(ideation_mode, case when gate_after_ideation then 'approval' else 'automatic' end),
  branding_mode = coalesce(branding_mode, case when gate_after_branding then 'approval' else 'automatic' end),
  planning_mode = coalesce(planning_mode, case when gate_after_planning then 'approval' else 'automatic' end),
  development_mode = coalesce(development_mode, case when gate_after_development then 'approval' else 'automatic' end),
  deployment_mode = coalesce(deployment_mode, case when gate_after_deployment then 'approval' else 'automatic' end);

alter table public.hitl_config
  alter column research_mode set default 'approval',
  alter column ideation_mode set default 'approval',
  alter column branding_mode set default 'approval',
  alter column planning_mode set default 'approval',
  alter column development_mode set default 'approval',
  alter column deployment_mode set default 'automatic',
  alter column research_mode set not null,
  alter column ideation_mode set not null,
  alter column branding_mode set not null,
  alter column planning_mode set not null,
  alter column development_mode set not null,
  alter column deployment_mode set not null;

alter table public.hitl_config
  drop constraint if exists hitl_config_research_mode_check,
  drop constraint if exists hitl_config_ideation_mode_check,
  drop constraint if exists hitl_config_branding_mode_check,
  drop constraint if exists hitl_config_planning_mode_check,
  drop constraint if exists hitl_config_development_mode_check,
  drop constraint if exists hitl_config_deployment_mode_check;

alter table public.hitl_config
  add constraint hitl_config_research_mode_check check (research_mode in ('automatic', 'approval', 'interactive')),
  add constraint hitl_config_ideation_mode_check check (ideation_mode in ('automatic', 'approval', 'interactive')),
  add constraint hitl_config_branding_mode_check check (branding_mode in ('automatic', 'approval', 'interactive')),
  add constraint hitl_config_planning_mode_check check (planning_mode in ('automatic', 'approval', 'interactive')),
  add constraint hitl_config_development_mode_check check (development_mode in ('automatic', 'approval', 'interactive')),
  add constraint hitl_config_deployment_mode_check check (deployment_mode in ('automatic', 'approval', 'interactive'));

create table if not exists public.stage_messages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  stage text not null check (stage in ('research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution')),
  role text not null check (role in ('system', 'assistant', 'user')),
  kind text not null default 'message' check (kind in ('message', 'prd_draft')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stage_messages_run_stage_created
  on public.stage_messages(run_id, stage, created_at);

alter publication supabase_realtime add table public.stage_messages;

alter table public.stage_messages enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where policyname = 'anon_read_stage_messages'
      and tablename = 'stage_messages'
  ) then
    create policy "anon_read_stage_messages"
      on public.stage_messages
      for select
      using (true);
  end if;
end $$;
