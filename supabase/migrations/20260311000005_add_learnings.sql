CREATE TABLE public.learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  run_id uuid REFERENCES public.runs(id),
  category text NOT NULL CHECK (category IN ('build', 'deploy', 'distribution', 'feedback', 'idea')),
  lesson text NOT NULL,
  impact text NOT NULL DEFAULT 'neutral' CHECK (impact IN ('positive', 'negative', 'neutral')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_learnings_category ON public.learnings(category);

ALTER TABLE public.learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_learnings" ON public.learnings FOR SELECT USING (true);
