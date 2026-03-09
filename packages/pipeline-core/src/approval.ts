import type { Department } from '@daio/shared';

export type ApprovalProviderId = 'dashboard' | 'telegram';
export type ApprovalKind = 'approve-reject' | 'select-one' | 'rank';

export interface ApprovalPolicy {
  providers: ApprovalProviderId[];
  quorum?: number;
  expiresAt?: string;
}

export interface ApprovalRequest<Decision = unknown> {
  key: string;
  stage: Department;
  kind: ApprovalKind;
  subject: string;
  payload: unknown;
  policy: ApprovalPolicy;
}

export interface ApprovalPublication {
  requestId: string;
  publishedAt: string;
}

export interface ApprovalResolution<Decision = unknown> {
  requestId: string;
  decision: Decision;
  actorId?: string;
  actorName?: string;
  provider?: ApprovalProviderId;
  reason?: string;
  resolvedAt: string;
}

export interface ApprovalProvider {
  id: ApprovalProviderId;
  publish(request: ApprovalRequest): Promise<void>;
}

export interface ApprovalService {
  publish<Decision>(request: ApprovalRequest<Decision>): Promise<ApprovalPublication>;
  resolve<Decision>(resolution: ApprovalResolution<Decision>): Promise<void>;
}
