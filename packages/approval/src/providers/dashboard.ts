import type { ApprovalProvider, ApprovalRequest } from '@daio/pipeline-core';

export interface DashboardApprovalProviderOptions {
  onPublish?: (request: ApprovalRequest) => Promise<void> | void;
}

export class DashboardApprovalProvider implements ApprovalProvider {
  readonly id = 'dashboard' as const;

  constructor(private readonly options: DashboardApprovalProviderOptions = {}) {}

  async publish(request: ApprovalRequest): Promise<void> {
    await this.options.onPublish?.(request);
  }
}
