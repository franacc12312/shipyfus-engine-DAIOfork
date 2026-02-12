-- Add branding gate to HITL config
-- ===================================

alter table public.hitl_config
  add column gate_after_branding boolean not null default true;
