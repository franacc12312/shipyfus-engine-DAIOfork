export type ExecutionMode = 'oneshot' | 'loop';

export interface StageDefinition {
  name: string;
  mode: ExecutionMode;
  order: number;
}

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  research: { name: 'research', mode: 'oneshot', order: 0 },
  ideation: { name: 'ideation', mode: 'oneshot', order: 1 },
  branding: { name: 'branding', mode: 'oneshot', order: 2 },
  planning: { name: 'planning', mode: 'oneshot', order: 3 },
  development: { name: 'development', mode: 'loop', order: 4 },
  deployment: { name: 'deployment', mode: 'oneshot', order: 5 },
  distribution: { name: 'distribution', mode: 'oneshot', order: 6 },
};

export const STAGE_ORDER = ['research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution'] as const;
