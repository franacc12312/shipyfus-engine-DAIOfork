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

// HITL schemas

export const stageStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'skipped', 'awaiting_approval']);

export const hitlConfigSchema = z.object({
  enabled: z.boolean(),
  gate_after_ideation: z.boolean(),
  gate_after_planning: z.boolean(),
  gate_after_development: z.boolean(),
});

export const updateHitlConfigSchema = z.object({
  enabled: z.boolean().optional(),
  gate_after_ideation: z.boolean().optional(),
  gate_after_planning: z.boolean().optional(),
  gate_after_development: z.boolean().optional(),
});

export const hitlGateActionSchema = z.enum(['approve', 'retry', 'cancel']);

export const rejectStageSchema = z.object({
  action: z.enum(['retry', 'cancel']),
});
