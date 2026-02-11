-- Agents table: one persona per pipeline stage (expandable to multiple per stage for DAI-8 council)
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  stage text not null,
  role_description text not null,
  avatar_url text,
  characteristics jsonb default '{}',
  is_active boolean default true,
  display_order int default 0,
  created_at timestamptz not null default now()
);

create index idx_agents_stage on public.agents(stage);
create index idx_agents_slug on public.agents(slug);

-- Add agent_id to logs (nullable for backward compatibility with existing logs)
alter table public.logs add column agent_id uuid references public.agents(id);
create index idx_logs_agent_id on public.logs(agent_id);

-- Seed the 4 default agents
insert into public.agents (slug, name, stage, role_description, characteristics, display_order) values
  ('ideator', 'Nova', 'ideation', 'Product Ideation Specialist', '{"tone": "creative and enthusiastic", "emoji": "💡", "color": "#4ade80"}', 0),
  ('planner', 'Atlas', 'planning', 'Software Architect', '{"tone": "methodical and precise", "emoji": "📐", "color": "#22d3ee"}', 0),
  ('developer', 'Forge', 'development', 'Full-Stack Developer', '{"tone": "focused and pragmatic", "emoji": "⚒️", "color": "#fbbf24"}', 0),
  ('deployer', 'Orbit', 'deployment', 'DevOps Engineer', '{"tone": "reliable and efficient", "emoji": "🚀", "color": "#a78bfa"}', 0);
