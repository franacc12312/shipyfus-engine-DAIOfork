-- Add 'research' to constraints department check
ALTER TABLE public.constraints DROP CONSTRAINT IF EXISTS constraints_department_check;
ALTER TABLE public.constraints ADD CONSTRAINT constraints_department_check
  CHECK (department IN ('research','ideation','branding','planning','development','deployment'));

-- Insert default research constraint (disabled by default)
INSERT INTO public.constraints (department, config, updated_by)
VALUES ('research', '{"enabled": false}', '00000000-0000-0000-0000-000000000001');

-- Insert Scout agent
INSERT INTO public.agents (slug, name, stage, role_description, characteristics, display_order)
VALUES ('researcher', 'Scout', 'research', 'Market Research Analyst',
  '{"tone": "analytical and curious", "emoji": "\ud83d\udd0d", "color": "#60a5fa"}', 0);

-- Update display_order for existing agents to make room for Scout at 0
UPDATE public.agents SET display_order = display_order + 1 WHERE slug != 'researcher';

-- Add research gate to HITL config
ALTER TABLE public.hitl_config
  ADD COLUMN IF NOT EXISTS gate_after_research boolean NOT NULL DEFAULT true;
