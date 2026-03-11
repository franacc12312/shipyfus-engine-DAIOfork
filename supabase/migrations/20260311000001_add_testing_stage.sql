-- Add testing stage support

-- 1. Update department check constraint to include 'testing'
ALTER TABLE constraints DROP CONSTRAINT IF EXISTS constraints_department_check;
ALTER TABLE constraints ADD CONSTRAINT constraints_department_check
  CHECK (department IN ('research', 'ideation', 'branding', 'planning', 'testing', 'development', 'deployment', 'distribution'));

-- 2. Insert default testing constraint
INSERT INTO constraints (department, config, updated_by)
VALUES ('testing', '{"framework": "playwright", "require_e2e": true}', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (department) DO NOTHING;

-- 3. Update agents department check and insert Tester
ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_stage_check;
ALTER TABLE agents ADD CONSTRAINT agents_stage_check
  CHECK (stage IN ('research', 'ideation', 'branding', 'planning', 'testing', 'development', 'deployment', 'distribution'));

INSERT INTO agents (slug, name, stage, role_description, characteristics, is_active, display_order)
VALUES (
  'tester',
  'Tester',
  'testing',
  'Test Engineer',
  '{"tone": "precise and methodical", "emoji": "🧪", "color": "#22c55e"}',
  true,
  4
)
ON CONFLICT (slug) DO NOTHING;
