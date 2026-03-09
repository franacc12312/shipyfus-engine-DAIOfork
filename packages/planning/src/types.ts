import type { AnalyticsConfig, PlanningConfig, ProductPRD } from '@daio/shared';

export interface PlanMetadata {
  planFilePath?: string;
  progressFilePath?: string;
  phases?: string[];
  totalTasks?: number;
  [key: string]: unknown;
}

export interface PlanningStageInput {
  prd: ProductPRD;
  config: PlanningConfig;
  analytics?: AnalyticsConfig;
  agentId?: string;
  maxBudgetUsd?: number;
}

export interface PlanningStageOutput {
  plan: PlanMetadata;
  costUsd: number;
}
