import type { IdeationConfig, ProductPRD } from '@daio/shared';

export interface IdeaScorecard {
  feasibility: number;
  clarity: number;
  demoability: number;
  usefulness: number;
  total: number;
}

export interface IdeaCandidate {
  id: string;
  prd: ProductPRD;
  scorecard: IdeaScorecard;
}

export interface IdeationStageInput {
  config: IdeationConfig;
  researchMarkdown?: string | null;
  maxBudgetUsd?: number;
  agentId?: string;
}

export interface IdeationStageOutput {
  prd: ProductPRD;
  candidates: IdeaCandidate[];
  costUsd: number;
}

export interface IdeaSelectionDecision {
  candidateId: string;
}
