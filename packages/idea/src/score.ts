import type { IdeationConfig, ProductPRD } from '@daio/shared';
import type { IdeaScorecard } from './types.js';

function clamp(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function scoreIdeaCandidate(prd: ProductPRD, config: IdeationConfig): IdeaScorecard {
  const featureCount = prd.coreFunctionality.length;
  const feasibility = clamp(
    8
      - Math.max(0, featureCount - 3)
      + (config.complexity === 'trivial' ? 1 : 0)
      + (config.complexity === 'moderate' ? -1 : 0),
  );

  const clarity = clamp(
    6
      + (prd.productDescription.length >= 40 ? 1 : 0)
      + (prd.problemStatement.length >= 20 ? 1 : 0)
      + (prd.uniqueValue.length >= 10 ? 1 : 0)
      + (prd.successCriteria.length >= 2 ? 1 : 0),
  );

  const demoabilityBase = config.platform === 'web' ? 9
    : config.platform === 'cli' ? 7
    : config.platform === 'api' ? 6
    : 5;
  const demoability = clamp(demoabilityBase - Math.max(0, featureCount - 4));

  const usefulness = clamp(
    6
      + (prd.targetUser.trim().length > 0 ? 1 : 0)
      + (prd.problemStatement.length >= 20 ? 2 : 0)
      + (prd.successCriteria.length >= 2 ? 1 : 0),
  );

  return {
    feasibility: round(feasibility),
    clarity: round(clarity),
    demoability: round(demoability),
    usefulness: round(usefulness),
    total: round((feasibility + clarity + demoability + usefulness) / 4),
  };
}
