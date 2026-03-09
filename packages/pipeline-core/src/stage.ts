import type { Department } from '@daio/shared';
import type { ApprovalRequest, ApprovalService } from './approval.js';

export type StageId = Department;

export interface AgentRunOptions {
  runId: string;
  stage: StageId;
  cwd: string;
  maxBudgetUsd?: number;
  iteration?: number;
  agentId?: string;
}

export interface AgentRunResult {
  text: string;
  json: unknown | null;
  cost: number;
}

export interface AgentLoopResult extends AgentRunResult {
  iterations: number;
  completed: boolean;
}

export interface AgentRuntime {
  runOnce(prompt: string, options: AgentRunOptions): Promise<AgentRunResult>;
  runLoop?(
    prompt: string,
    options: AgentRunOptions & { maxIterations: number; completionPromise?: string },
  ): Promise<AgentLoopResult>;
}

export interface StageLogMetadata {
  [key: string]: string | number | boolean | null | undefined;
}

export interface StageLogger {
  info(message: string, metadata?: StageLogMetadata): Promise<void>;
  warn(message: string, metadata?: StageLogMetadata): Promise<void>;
  error(message: string, metadata?: StageLogMetadata): Promise<void>;
}

export interface ArtifactStore {
  readText(relativePath: string): Promise<string>;
  writeText(relativePath: string, content: string): Promise<void>;
  exists(relativePath: string): Promise<boolean>;
  resolve(relativePath: string): string;
}

export interface StageContext {
  runId: string;
  stage: StageId;
  productDir: string;
  runner: AgentRuntime;
  logger: StageLogger;
  artifacts: ArtifactStore;
  approvals: ApprovalService;
  now: () => string;
}

export interface PendingStage<Output, Decision> {
  state: Record<string, unknown>;
  approval: ApprovalRequest<Decision>;
  preview?: Output;
}

export type StageResult<Output, Decision = never> =
  | {
      status: 'completed';
      output: Output;
      metrics?: Record<string, unknown>;
    }
  | {
      status: 'awaiting_approval';
      pending: PendingStage<Output, Decision>;
    }
  | {
      status: 'failed';
      error: string;
      recoverable?: boolean;
    };

export interface PipelineStage<Input, Output, Decision = never> {
  id: StageId;
  run(ctx: StageContext, input: Input): Promise<StageResult<Output, Decision>>;
  resume?(
    ctx: StageContext,
    pending: PendingStage<Output, Decision>,
    decision: Decision,
  ): Promise<StageResult<Output, Decision>>;
}
