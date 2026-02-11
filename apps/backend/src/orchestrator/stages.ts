export type ExecutionMode = 'oneshot' | 'loop';

export interface StageDefinition {
  name: string;
  mode: ExecutionMode;
  order: number;
}

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  ideation: { name: 'ideation', mode: 'oneshot', order: 0 },
  branding: { name: 'branding', mode: 'oneshot', order: 1 },
  planning: { name: 'planning', mode: 'oneshot', order: 2 },
  development: { name: 'development', mode: 'loop', order: 3 },
  deployment: { name: 'deployment', mode: 'oneshot', order: 4 },
};

export const STAGE_ORDER = ['ideation', 'branding', 'planning', 'development', 'deployment'] as const;
