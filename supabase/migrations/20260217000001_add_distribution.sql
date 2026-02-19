-- Add distribution stage support

-- 1. Update department check constraint to include 'distribution'
ALTER TABLE constraints DROP CONSTRAINT IF EXISTS constraints_department_check;
ALTER TABLE constraints ADD CONSTRAINT constraints_department_check
  CHECK (department IN ('research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution'));

-- 2. Insert default distribution constraint
INSERT INTO constraints (department, config, updated_by)
VALUES ('distribution', '{"enabled": true, "platforms": ["twitter"]}', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (department) DO NOTHING;

-- 3. Update agents department check and insert Herald
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_stage_check;
ALTER TABLE agents ADD CONSTRAINT agents_stage_check
  CHECK (stage IN ('research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution'));

INSERT INTO agents (slug, name, stage, role_description, characteristics, is_active, display_order)
VALUES (
  'herald',
  'Herald',
  'distribution',
  'Launch Announcer',
  '{"tone": "energetic and concise", "emoji": "📢", "color": "#1da1f2"}',
  true,
  7
)
ON CONFLICT (slug) DO NOTHING;

-- 4. Add gate_after_deployment to hitl_config
ALTER TABLE hitl_config ADD COLUMN IF NOT EXISTS gate_after_deployment boolean NOT NULL DEFAULT false;
