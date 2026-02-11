import { z } from 'zod';

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

export const deploymentConfigSchema = z.object({
  provider: z.enum(['vercel']).optional(),
  auto_deploy: z.boolean().optional(),
  custom_rules: z.array(z.string()).optional(),
});

export const constraintConfigSchemas = {
  ideation: ideationConfigSchema,
  planning: planningConfigSchema,
  development: developmentConfigSchema,
  deployment: deploymentConfigSchema,
} as const;

export const departmentSchema = z.enum(['ideation', 'planning', 'development', 'deployment']);

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
