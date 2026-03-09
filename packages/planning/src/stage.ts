import type { PipelineStage } from '@daio/pipeline-core';
import { buildPlannerPrompt } from './prompts.js';
import { planMetadataSchema } from './schemas.js';
import type { PlanningStageInput, PlanningStageOutput } from './types.js';

export function createPlanningStage(): PipelineStage<PlanningStageInput, PlanningStageOutput> {
  return {
    id: 'planning',
    async run(ctx, input) {
      const prompt = buildPlannerPrompt(input.prd, input.config, input.analytics);
      const result = await ctx.runner.runOnce(prompt, {
        runId: ctx.runId,
        stage: 'planning',
        cwd: ctx.productDir,
        maxBudgetUsd: input.maxBudgetUsd ?? 5,
        agentId: input.agentId,
      });

      const parsed = planMetadataSchema.safeParse(result.json);
      if (!parsed.success) {
        await ctx.logger.error('Planning output did not match expected plan metadata shape');
        return {
          status: 'failed',
          error: 'Planning failed to produce plan metadata',
          recoverable: true,
        };
      }

      await ctx.logger.info('Planning metadata generated', {
        phaseCount: parsed.data.phases?.length ?? 0,
        totalTasks: parsed.data.totalTasks ?? 0,
      });

      return {
        status: 'completed',
        output: {
          plan: parsed.data,
          costUsd: result.cost,
        },
        metrics: {
          costUsd: result.cost,
          phaseCount: parsed.data.phases?.length ?? 0,
          totalTasks: parsed.data.totalTasks ?? 0,
        },
      };
    },
  };
}
