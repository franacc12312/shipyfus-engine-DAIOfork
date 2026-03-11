-- Backlog for storing and managing ideas
CREATE TABLE public.backlog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source text DEFAULT 'manual', -- manual, trends, ai
  scores jsonb DEFAULT '{}', -- {viralPotential, executionEase, distributionClarity, moatScore, totalScore}
  market_data jsonb DEFAULT '{}', -- {competitors, verdict, differentiationAngle}
  template text, -- recommended template name
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'shipped', 'expired')),
  priority int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '14 days'),
  shipped_at timestamptz,
  run_id uuid REFERENCES public.runs(id)
);

CREATE INDEX idx_backlog_status ON public.backlog(status);

ALTER TABLE public.backlog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_backlog" ON public.backlog FOR SELECT USING (true);

-- Auto-expire old ideas (can be run via cron or triggered)
-- Max 10 pending items - enforced at app level

ALTER PUBLICATION supabase_realtime ADD TABLE public.backlog;
