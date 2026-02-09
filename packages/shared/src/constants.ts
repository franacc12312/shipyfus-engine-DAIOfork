import type { Department, RunStatus, StageStatus } from './types.js';

export const STAGES: readonly Department[] = ['ideation', 'planning', 'development', 'deployment'] as const;

export const RUN_STATUSES: readonly RunStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const;

export const STAGE_STATUSES: readonly StageStatus[] = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;

export const EVENT_TYPES = {
  SYSTEM: 'system',
  ASSISTANT: 'assistant',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
  RESULT: 'result',
  ERROR: 'error',
} as const;

export const COMPLETION_PROMISE = 'PRODUCT COMPLETE';

export const DEFAULT_MAX_ITERATIONS = 20;
export const DEFAULT_MAX_BUDGET_USD = 10;
