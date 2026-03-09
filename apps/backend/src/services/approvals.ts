import type {
  ApprovalPublication,
  ApprovalRequest,
  ApprovalResolution,
  ApprovalService,
} from '@daio/pipeline-core';
import type { Department, DomainChoice } from '@daio/shared';
import { db } from './db.js';

const SUPABASE_NO_ROWS_ERROR = 'PGRST116';

type ApprovalOutcome = 'approved' | 'retry' | 'cancel';

export interface StageApprovalDecision {
  action?: 'approve' | 'retry' | 'cancel';
  chosen_domain?: DomainChoice;
}

interface ApprovalRequestRow {
  id: string;
  created_at?: string;
}

function isNoRowsError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === SUPABASE_NO_ROWS_ERROR,
  );
}

function getApprovalOutcome(decision: unknown): ApprovalOutcome {
  if (!decision || typeof decision !== 'object') {
    return 'approved';
  }

  const action = 'action' in decision ? (decision as { action?: string }).action : undefined;
  if (action === 'retry' || action === 'cancel') {
    return action;
  }

  return 'approved';
}

function buildApprovalSubject(stage: Department): string {
  switch (stage) {
    case 'branding':
      return 'Review branding candidates before purchase';
    case 'deployment':
      return 'Review deployment result before launch';
    case 'distribution':
      return 'Review launch distribution output';
    default:
      return `Review ${stage} output before continuing`;
  }
}

export function buildStageApprovalRequest(
  stage: Department,
  payload: unknown,
): ApprovalRequest<StageApprovalDecision> {
  return {
    key: 'human-review',
    stage,
    kind: stage === 'branding' ? 'select-one' : 'approve-reject',
    subject: buildApprovalSubject(stage),
    payload: payload ?? {},
    policy: {
      providers: ['dashboard'],
    },
  };
}

export class DatabaseApprovalService implements ApprovalService {
  constructor(
    private readonly runId: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async publish<Decision>(request: ApprovalRequest<Decision>): Promise<ApprovalPublication> {
    const { data: existing, error: existingError } = await db
      .from('approval_requests')
      .select('id, created_at')
      .eq('run_id', this.runId)
      .eq('stage', request.stage)
      .eq('request_key', request.key)
      .eq('status', 'pending')
      .single();

    if (existingError && !isNoRowsError(existingError)) {
      throw existingError;
    }

    if (existing) {
      const row = existing as ApprovalRequestRow;
      return {
        requestId: row.id,
        publishedAt: row.created_at ?? this.now(),
      };
    }

    const publishedAt = this.now();
    const { data, error } = await db
      .from('approval_requests')
      .insert({
        run_id: this.runId,
        stage: request.stage,
        request_key: request.key,
        kind: request.kind,
        subject: request.subject,
        payload: request.payload ?? {},
        policy: request.policy,
        status: 'pending',
        created_at: publishedAt,
        updated_at: publishedAt,
      })
      .select('id, created_at')
      .single();

    if (error) {
      throw error;
    }

    const row = data as ApprovalRequestRow;
    return {
      requestId: row.id,
      publishedAt: row.created_at ?? publishedAt,
    };
  }

  async resolve<Decision>(resolution: ApprovalResolution<Decision>): Promise<void> {
    const resolvedAt = resolution.resolvedAt ?? this.now();
    const { error } = await db
      .from('approval_requests')
      .update({
        status: 'resolved',
        outcome: getApprovalOutcome(resolution.decision),
        decision: resolution.decision ?? {},
        provider: resolution.provider,
        actor_id: resolution.actorId,
        actor_name: resolution.actorName,
        reason: resolution.reason,
        resolved_at: resolvedAt,
        updated_at: resolvedAt,
      })
      .eq('id', resolution.requestId)
      .eq('status', 'pending');

    if (error) {
      throw error;
    }
  }
}

export function createApprovalService(runId: string): ApprovalService {
  return new DatabaseApprovalService(runId);
}

export async function resolvePendingApprovalRequest(params: {
  runId: string;
  stage: Department;
  decision: StageApprovalDecision;
  actorId?: string;
  actorName?: string;
  provider?: 'dashboard' | 'telegram';
  reason?: string;
  resolvedAt?: string;
}): Promise<string | null> {
  const { data, error } = await db
    .from('approval_requests')
    .select('id')
    .eq('run_id', params.runId)
    .eq('stage', params.stage)
    .eq('status', 'pending')
    .single();

  if (error) {
    if (isNoRowsError(error)) {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  const requestId = (data as ApprovalRequestRow).id;
  await createApprovalService(params.runId).resolve({
    requestId,
    decision: params.decision,
    actorId: params.actorId,
    actorName: params.actorName,
    provider: params.provider,
    reason: params.reason,
    resolvedAt: params.resolvedAt ?? new Date().toISOString(),
  });

  return requestId;
}

export async function resolveAllPendingApprovalRequests(params: {
  runId: string;
  decision: StageApprovalDecision;
  actorId?: string;
  actorName?: string;
  provider?: 'dashboard' | 'telegram';
  reason?: string;
  resolvedAt?: string;
}): Promise<void> {
  const resolvedAt = params.resolvedAt ?? new Date().toISOString();
  const { error } = await db
    .from('approval_requests')
    .update({
      status: 'resolved',
      outcome: getApprovalOutcome(params.decision),
      decision: params.decision,
      provider: params.provider,
      actor_id: params.actorId,
      actor_name: params.actorName,
      reason: params.reason,
      resolved_at: resolvedAt,
      updated_at: resolvedAt,
    })
    .eq('run_id', params.runId)
    .eq('status', 'pending');

  if (error) {
    throw error;
  }
}
