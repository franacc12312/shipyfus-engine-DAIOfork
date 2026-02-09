export type ExecutionMode = 'oneshot' | 'loop';

export interface StageDefinition {
  name: string;
  mode: ExecutionMode;
  order: number;
}

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  ideation: { name: 'ideation', mode: 'oneshot', order: 0 },
  planning: { name: 'planning', mode: 'oneshot', order: 1 },
  development: { name: 'development', mode: 'loop', order: 2 },
  deployment: { name: 'deployment', mode: 'oneshot', order: 3 },
};

export const STAGE_ORDER = ['ideation', 'planning', 'development', 'deployment'] as const;
