import type { ApprovalProvider, ApprovalRequest } from '@daio/pipeline-core';

export interface TelegramApprovalProviderOptions {
  format?: (request: ApprovalRequest) => string;
  sendMessage: (message: { text: string; request: ApprovalRequest }) => Promise<void>;
}

export class TelegramApprovalProvider implements ApprovalProvider {
  readonly id = 'telegram' as const;

  constructor(private readonly options: TelegramApprovalProviderOptions) {}

  async publish(request: ApprovalRequest): Promise<void> {
    const text = this.options.format?.(request) ?? defaultTelegramMessage(request);
    await this.options.sendMessage({ text, request });
  }
}

function defaultTelegramMessage(request: ApprovalRequest): string {
  return [
    request.subject,
    `Stage: ${request.stage}`,
    `Decision type: ${request.kind}`,
  ].join('\n');
}
