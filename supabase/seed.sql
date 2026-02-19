-- Default owner user
insert into public.users (id, email, role) values
  ('00000000-0000-0000-0000-000000000001', 'owner@daio.local', 'owner');

-- Default constraints for all departments
insert into public.constraints (department, config, updated_by) values
  ('research', '{
    "enabled": false
  }', '00000000-0000-0000-0000-000000000001'),
  ('ideation', '{
    "platform": "web",
    "audience": "consumer",
    "complexity": "simple",
    "custom_rules": ["Must be completable in a single session", "Focus on utility apps"]
  }', '00000000-0000-0000-0000-000000000001'),
  ('planning', '{
    "max_phases": 5,
    "require_tests": true,
    "max_files_per_phase": 10,
    "custom_rules": ["Keep phases small and focused"]
  }', '00000000-0000-0000-0000-000000000001'),
  ('development', '{
    "framework": "react",
    "language": "typescript",
    "max_files": 20,
    "max_iterations": 20,
    "max_budget_usd": 10,
    "custom_rules": ["Use Vite for bundling", "Keep dependencies minimal"]
  }', '00000000-0000-0000-0000-000000000001'),
  ('deployment', '{
    "provider": "vercel",
    "auto_deploy": true,
    "custom_rules": ["Use production flag", "No custom domains for now"]
  }', '00000000-0000-0000-0000-000000000001'),
  ('distribution', '{
    "enabled": true,
    "platforms": ["twitter"]
  }', '00000000-0000-0000-0000-000000000001');
