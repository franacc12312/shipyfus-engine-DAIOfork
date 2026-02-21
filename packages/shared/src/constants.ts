import type { Department, RunStatus, StageStatus } from './types.js';

export const STAGES: readonly Department[] = ['research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution'] as const;

export const RUN_STATUSES: readonly RunStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'] as const;

export const STAGE_STATUSES: readonly StageStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'awaiting_approval'] as const;

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

export const AGENT_SLUGS = {
  RESEARCHER: 'researcher',
  IDEATOR: 'ideator',
  BRANDER: 'brander',
  CFO: 'cfo',
  PLANNER: 'planner',
  DEVELOPER: 'developer',
  DEPLOYER: 'deployer',
  HERALD: 'herald',
} as const;

export const STAGE_AGENT_MAP: Record<Department, string> = {
  research: 'researcher',
  ideation: 'ideator',
  branding: 'brander',
  planning: 'planner',
  development: 'developer',
  deployment: 'deployer',
  distribution: 'herald',
} as const;

export const RETRY_MESSAGES = [
  'Alright chief, let\'s give this another go.',
  'Round two, here we come.',
  'On it — take two!',
  'Back at it. Fresh eyes, fresh run.',
  'No worries, let\'s roll again.',
  'Copy that. Spinning it up again.',
  'Let\'s try that one more time.',
  'Heard you loud and clear. Retrying now.',
  'Running it back.',
  'Second time\'s the charm, right?',
  'Say less. Restarting.',
  'Okay, let\'s see what we get this time.',
  'Dusting off and going again.',
  'Roger that. One more lap.',
  'Alright, clean slate. Here we go.',
  'Got it. Let me take another crack at this.',
  'New attempt incoming.',
  'Loading up the next attempt...',
  'Rewinding and pressing play.',
  'Let\'s give it another shot.',
  'Back to the drawing board — but faster this time.',
  'On it. Retry engaged.',
  'Sure thing, let\'s run it again.',
  'Taking it from the top.',
  'Trying again — we got this.',
  'Acknowledged. Re-running now.',
  'One more time, with feeling.',
  'Resetting and going again.',
  'You got it. Launching another attempt.',
  'Alright, let\'s see if the universe cooperates this time.',
] as const;

export function getRandomRetryMessage(): string {
  return RETRY_MESSAGES[Math.floor(Math.random() * RETRY_MESSAGES.length)];
}
