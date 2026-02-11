-- Add branding stage support: domain fields, branding constraint, and new agents

-- Add domain_name to runs and products
alter table public.runs add column domain_name text;
alter table public.products add column domain_name text;

-- Update department check constraint to include 'branding'
alter table public.constraints drop constraint constraints_department_check;
alter table public.constraints add constraint constraints_department_check
  check (department in ('ideation', 'branding', 'planning', 'development', 'deployment'));

-- Insert branding constraint with default config
insert into public.constraints (department, config)
values ('branding', '{"max_domain_price": 15, "preferred_tlds": ["xyz"]}');

-- Insert Prism (Brand Strategist) agent
insert into public.agents (slug, name, stage, role_description, characteristics, display_order)
values ('brander', 'Prism', 'branding', 'Brand Strategist', '{"tone": "creative and analytical", "emoji": "🎨", "color": "#f472b6"}', 0);

-- Insert Ledger (CFO) utility agent — runs in branding stage for domain purchases
insert into public.agents (slug, name, stage, role_description, characteristics, display_order)
values ('cfo', 'Ledger', 'branding', 'Chief Financial Officer', '{"tone": "cautious and precise", "emoji": "💰", "color": "#34d399"}', 0);
