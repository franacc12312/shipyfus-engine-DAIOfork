-- Multi-user support: Supabase Auth, per-user credentials, per-user constraints

-- 1. Extend users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supabase_auth_id uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS vercel_token_encrypted text,
  ADD COLUMN IF NOT EXISTS github_token_encrypted text,
  ADD COLUMN IF NOT EXISTS porkbun_api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS porkbun_api_secret_encrypted text;

-- Update role check to include 'admin' 
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('owner', 'admin', 'viewer'));

-- 2. Add user_id to constraints (per-user pipeline config)
ALTER TABLE public.constraints
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id);

-- Change unique constraint: department is unique per user (not globally)
ALTER TABLE public.constraints DROP CONSTRAINT IF EXISTS constraints_department_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'constraints_department_user_unique'
  ) THEN
    ALTER TABLE public.constraints ADD CONSTRAINT constraints_department_user_unique
      UNIQUE (department, user_id);
  END IF;
END $$;

-- 3. Add user_id to hitl_config (per-user HITL gates)
ALTER TABLE public.hitl_config
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id);

-- 4. Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hitl_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- 5. Helper function: get internal user_id from Supabase auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid AS $$
  SELECT id FROM public.users WHERE supabase_auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 6. RLS Policies

-- Users: can read own profile, admins/owners read all
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users FOR SELECT
  USING (supabase_auth_id = auth.uid() OR role = 'owner');

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
  USING (supabase_auth_id = auth.uid());

-- Runs: users see their own runs
DROP POLICY IF EXISTS "anon_read_runs" ON public.runs;
DROP POLICY IF EXISTS "runs_select_own" ON public.runs;
CREATE POLICY "runs_select_own" ON public.runs FOR SELECT
  USING (triggered_by = public.get_user_id());

DROP POLICY IF EXISTS "runs_insert_own" ON public.runs;
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT
  WITH CHECK (triggered_by = public.get_user_id());

DROP POLICY IF EXISTS "runs_update_own" ON public.runs;
CREATE POLICY "runs_update_own" ON public.runs FOR UPDATE
  USING (triggered_by = public.get_user_id());

-- Run stages: visible if run is visible
DROP POLICY IF EXISTS "stages_select_own" ON public.run_stages;
CREATE POLICY "stages_select_own" ON public.run_stages FOR SELECT
  USING (run_id IN (SELECT id FROM public.runs WHERE triggered_by = public.get_user_id()));

-- Logs: visible if run is visible
DROP POLICY IF EXISTS "logs_select_own" ON public.logs;
CREATE POLICY "logs_select_own" ON public.logs FOR SELECT
  USING (run_id IN (SELECT id FROM public.runs WHERE triggered_by = public.get_user_id()));

-- Products: visible if run is visible
DROP POLICY IF EXISTS "anon_read_products" ON public.products;
DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own" ON public.products FOR SELECT
  USING (run_id IN (SELECT id FROM public.runs WHERE triggered_by = public.get_user_id()));

-- Constraints: users see their own constraints
DROP POLICY IF EXISTS "anon_read_constraints" ON public.constraints;
DROP POLICY IF EXISTS "constraints_select_own" ON public.constraints;
CREATE POLICY "constraints_select_own" ON public.constraints FOR SELECT
  USING (user_id = public.get_user_id() OR user_id IS NULL);

DROP POLICY IF EXISTS "constraints_insert_own" ON public.constraints;
CREATE POLICY "constraints_insert_own" ON public.constraints FOR INSERT
  WITH CHECK (user_id = public.get_user_id());

DROP POLICY IF EXISTS "constraints_update_own" ON public.constraints;
CREATE POLICY "constraints_update_own" ON public.constraints FOR UPDATE
  USING (user_id = public.get_user_id());

-- HITL config: per-user
DROP POLICY IF EXISTS "hitl_select_own" ON public.hitl_config;
CREATE POLICY "hitl_select_own" ON public.hitl_config FOR SELECT
  USING (user_id = public.get_user_id() OR user_id IS NULL);

DROP POLICY IF EXISTS "hitl_update_own" ON public.hitl_config;
CREATE POLICY "hitl_update_own" ON public.hitl_config FOR UPDATE
  USING (user_id = public.get_user_id());

-- Agents: readable by all authenticated users (shared config)
DROP POLICY IF EXISTS "agents_select_all" ON public.agents;
CREATE POLICY "agents_select_all" ON public.agents FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Approval requests: visible if run is visible
DROP POLICY IF EXISTS "approvals_select_own" ON public.approval_requests;
CREATE POLICY "approvals_select_own" ON public.approval_requests FOR SELECT
  USING (run_id IN (SELECT id FROM public.runs WHERE triggered_by = public.get_user_id()));

-- 7. Service role bypasses RLS (for backend operations)
-- Backend uses service_role key which bypasses RLS automatically

-- 8. Auto-create user profile on Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (email, supabase_auth_id, role, display_name)
  VALUES (
    NEW.email,
    NEW.id,
    'viewer',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Function to seed default constraints for a new user
CREATE OR REPLACE FUNCTION public.seed_user_constraints(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.constraints (department, config, user_id, updated_by)
  SELECT department, config, p_user_id, p_user_id
  FROM public.constraints
  WHERE user_id IS NULL
  ON CONFLICT (department, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to seed default HITL config for a new user
CREATE OR REPLACE FUNCTION public.seed_user_hitl(p_user_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.hitl_config (user_id, enabled)
  SELECT p_user_id, enabled
  FROM public.hitl_config
  WHERE user_id IS NULL
  LIMIT 1
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
