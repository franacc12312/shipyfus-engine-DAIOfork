import type { PipelineStage } from '@daio/pipeline-core';
import { buildIdeatorPrompt } from './prompts.js';
import { productPRDSchema } from './schemas.js';
import { scoreIdeaCandidate } from './score.js';
import type { IdeaCandidate, IdeationStageInput, IdeationStageOutput } from './types.js';

function buildCandidateId(productName: string): string {
  const normalized = productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'idea-candidate-1';
}

export function createIdeationStage(): PipelineStage<IdeationStageInput, IdeationStageOutput> {
  return {
    id: 'ideation',
    async run(ctx, input) {
      const prompt = buildIdeatorPrompt(input.config, input.researchMarkdown ?? undefined);
      const result = await ctx.runner.runOnce(prompt, {
        runId: ctx.runId,
        stage: 'ideation',
        cwd: ctx.productDir,
        maxBudgetUsd: input.maxBudgetUsd ?? 3,
        agentId: input.agentId,
      });

      const parsed = productPRDSchema.safeParse(result.json);
      if (!parsed.success) {
        await ctx.logger.error('Ideation output did not match ProductPRD schema');
        return {
          status: 'failed',
          error: 'Ideation failed to produce a valid PRD',
          recoverable: true,
        };
      }

      const prd = parsed.data;
      const candidate: IdeaCandidate = {
        id: buildCandidateId(prd.productName),
        prd,
        scorecard: scoreIdeaCandidate(prd, input.config),
      };

      await ctx.logger.info('Ideation candidate generated', {
        productName: prd.productName,
        totalScore: candidate.scorecard.total,
      });

      return {
        status: 'completed',
        output: {
          prd,
          candidates: [candidate],
          costUsd: result.cost,
        },
        metrics: {
          candidateCount: 1,
          costUsd: result.cost,
          totalScore: candidate.scorecard.total,
        },
      };
    },
  };
}
