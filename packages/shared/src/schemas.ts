import { z } from 'zod';

export const researchConfigSchema = z.object({
  enabled: z.boolean().optional(),
  topics: z.array(z.string()).optional(),
  max_searches: z.number().int().min(1).max(20).optional(),
  sources: z.array(z.string()).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const ideationConfigSchema = z.object({
  platform: z.enum(['web', 'cli', 'api', 'library']).optional(),
  audience: z.enum(['consumer', 'developer', 'business']).optional(),
  complexity: z.enum(['trivial', 'simple', 'moderate']).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const planningConfigSchema = z.object({
  max_phases: z.number().int().min(1).max(10).optional(),
  require_tests: z.boolean().optional(),
  max_files_per_phase: z.number().int().min(1).max(50).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const developmentConfigSchema = z.object({
  framework: z.string().optional(),
  language: z.string().optional(),
  max_files: z.number().int().min(1).max(100).optional(),
  max_iterations: z.number().int().min(1).max(50).optional(),
  max_budget_usd: z.number().min(0.1).max(100).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const brandingConfigSchema = z.object({
  max_domain_price: z.number().min(1).max(200).optional(),
  preferred_tlds: z.array(z.string()).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const deploymentConfigSchema = z.object({
  provider: z.enum(['vercel']).optional(),
  auto_deploy: z.boolean().optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const distributionConfigSchema = z.object({
  enabled: z.boolean().optional(),
  platforms: z.array(z.string()).optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const constraintConfigSchemas = {
  research: researchConfigSchema,
  ideation: ideationConfigSchema,
  branding: brandingConfigSchema,
  planning: planningConfigSchema,
  development: developmentConfigSchema,
  deployment: deploymentConfigSchema,
  distribution: distributionConfigSchema,
} as const;

export const departmentSchema = z.enum(['research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution']);

export const updateConstraintSchema = z.object({
  config: z.record(z.unknown()),
});

export const agentCharacteristicsSchema = z.object({
  tone: z.string().optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
}).passthrough();

export const agentSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  stage: departmentSchema,
  role_description: z.string(),
  avatar_url: z.string().url().nullable(),
  characteristics: agentCharacteristicsSchema,
  is_active: z.boolean(),
  display_order: z.number().int(),
  created_at: z.string(),
});

// Participant schemas

export const participantSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  role_title: z.string().min(1),
  avatar_url: z.string().url().nullable(),
  is_active: z.boolean(),
  display_order: z.number().int(),
  created_at: z.string(),
});

export const createParticipantSchema = z.object({
  name: z.string().min(1),
  role_title: z.string().min(1),
  user_id: z.string().uuid().optional(),
  avatar_url: z.string().url().optional(),
});

// HITL schemas

export const stageStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'awaiting_approval']);

export const hitlConfigSchema = z.object({
  enabled: z.boolean(),
  gate_after_research: z.boolean(),
  gate_after_ideation: z.boolean(),
  gate_after_branding: z.boolean(),
  gate_after_planning: z.boolean(),
  gate_after_development: z.boolean(),
  gate_after_deployment: z.boolean(),
});

export const updateHitlConfigSchema = z.object({
  enabled: z.boolean().optional(),
  gate_after_research: z.boolean().optional(),
  gate_after_ideation: z.boolean().optional(),
  gate_after_branding: z.boolean().optional(),
  gate_after_planning: z.boolean().optional(),
  gate_after_development: z.boolean().optional(),
  gate_after_deployment: z.boolean().optional(),
});

export const hitlGateActionSchema = z.enum(['approve', 'retry', 'cancel']);

export const domainChoiceSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1),
  price: z.number().min(0),
  tld: z.string().min(1),
  strategy: z.string().min(1),
  reasoning: z.string(),
  score: z.number().min(0),
});

export const approveStageSchema = z.object({
  chosen_domain: domainChoiceSchema.optional(),
});

export const rejectStageSchema = z.object({
  action: z.enum(['retry', 'cancel']),
});
