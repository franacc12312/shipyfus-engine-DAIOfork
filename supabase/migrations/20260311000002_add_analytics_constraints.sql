-- Add analytics department to constraints
ALTER TABLE public.constraints DROP CONSTRAINT IF EXISTS constraints_department_check;
ALTER TABLE public.constraints ADD CONSTRAINT constraints_department_check 
  CHECK (department IN ('research', 'ideation', 'planning', 'testing', 'development', 'deployment', 'distribution', 'branding', 'analytics'));

INSERT INTO public.constraints (department, config, updated_by) VALUES
  ('analytics', '{"posthogKey": "", "feedbackEnabled": true, "feedbackTheme": "dark", "feedbackAccent": "#f97316"}', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (department) DO NOTHING;
