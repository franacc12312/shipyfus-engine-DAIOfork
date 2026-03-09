import type {
  ApprovalProvider,
  ApprovalPublication,
  ApprovalRequest,
  ApprovalResolution,
  ApprovalService,
} from '@daio/pipeline-core';

function buildRequestId(request: ApprovalRequest): string {
  return `${request.stage}:${request.key}`;
}

function getProvidersForRequest(request: ApprovalRequest, providers: ApprovalProvider[]): ApprovalProvider[] {
  const selected = providers.filter((provider) => request.policy.providers.includes(provider.id));
  if (selected.length !== request.policy.providers.length) {
    const missing = request.policy.providers.filter(
      (providerId) => !selected.some((provider) => provider.id === providerId),
    );
    throw new Error(`No approval providers registered for: ${missing.join(', ')}`);
  }
  return selected;
}

export class NoopApprovalService implements ApprovalService {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async publish<Decision>(request: ApprovalRequest<Decision>): Promise<ApprovalPublication> {
    return {
      requestId: buildRequestId(request),
      publishedAt: this.now(),
    };
  }

  async resolve<Decision>(_resolution: ApprovalResolution<Decision>): Promise<void> {
    // Intentionally empty. This is the default implementation until
    // the backend persists approval requests in a dedicated store.
  }
}

export class CompositeApprovalService implements ApprovalService {
  constructor(
    private readonly providers: ApprovalProvider[],
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async publish<Decision>(request: ApprovalRequest<Decision>): Promise<ApprovalPublication> {
    const selected = getProvidersForRequest(request, this.providers);
    await Promise.all(selected.map((provider) => provider.publish(request)));

    return {
      requestId: buildRequestId(request),
      publishedAt: this.now(),
    };
  }

  async resolve<Decision>(_resolution: ApprovalResolution<Decision>): Promise<void> {
    // Provider-specific resolution handling belongs in the application shell.
  }
}

export class MemoryApprovalService implements ApprovalService {
  private readonly requests = new Map<string, ApprovalRequest>();
  private readonly resolutions = new Map<string, ApprovalResolution<unknown>>();

  constructor(
    private readonly providers: ApprovalProvider[] = [],
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async publish<Decision>(request: ApprovalRequest<Decision>): Promise<ApprovalPublication> {
    const requestId = buildRequestId(request);
    this.requests.set(requestId, request);

    if (this.providers.length > 0) {
      const selected = getProvidersForRequest(request, this.providers);
      await Promise.all(selected.map((provider) => provider.publish(request)));
    }

    return {
      requestId,
      publishedAt: this.now(),
    };
  }

  async resolve<Decision>(resolution: ApprovalResolution<Decision>): Promise<void> {
    if (!this.requests.has(resolution.requestId)) {
      throw new Error(`Unknown approval request: ${resolution.requestId}`);
    }

    this.resolutions.set(resolution.requestId, resolution as ApprovalResolution<unknown>);
  }

  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  getResolution<Decision>(requestId: string): ApprovalResolution<Decision> | undefined {
    return this.resolutions.get(requestId) as ApprovalResolution<Decision> | undefined;
  }
}
