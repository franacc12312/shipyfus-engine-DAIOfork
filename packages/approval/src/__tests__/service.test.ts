import { describe, expect, it, vi } from 'vitest';
import { MemoryApprovalService, NoopApprovalService } from '../index.js';
import type { ApprovalProvider, ApprovalRequest } from '@daio/pipeline-core';

const request: ApprovalRequest<{ candidateId: string }> = {
  key: 'idea-review',
  stage: 'ideation',
  kind: 'select-one',
  subject: 'Pick the best idea',
  payload: { candidates: [{ id: 'idea-1', title: 'Idea One' }] },
  policy: {
    providers: ['dashboard', 'telegram'],
    quorum: 2,
  },
};

describe('MemoryApprovalService', () => {
  it('publishes to each requested provider and stores the request', async () => {
    const dashboard: ApprovalProvider = {
      id: 'dashboard',
      publish: vi.fn().mockResolvedValue(undefined),
    };
    const telegram: ApprovalProvider = {
      id: 'telegram',
      publish: vi.fn().mockResolvedValue(undefined),
    };

    const service = new MemoryApprovalService([dashboard, telegram], () => '2026-03-09T00:00:00.000Z');
    const publication = await service.publish(request);

    expect(publication.requestId).toBe('ideation:idea-review');
    expect(dashboard.publish).toHaveBeenCalledWith(request);
    expect(telegram.publish).toHaveBeenCalledWith(request);
    expect(service.getRequest(publication.requestId)).toEqual(request);
  });

  it('stores resolutions for known requests', async () => {
    const service = new MemoryApprovalService([], () => '2026-03-09T00:00:00.000Z');
    const publication = await service.publish(request);

    await service.resolve({
      requestId: publication.requestId,
      decision: { candidateId: 'idea-1' },
      actorName: 'telegram-group',
      provider: 'telegram',
      resolvedAt: '2026-03-09T00:01:00.000Z',
    });

    expect(service.getResolution<{ candidateId: string }>(publication.requestId)?.decision).toEqual({
      candidateId: 'idea-1',
    });
  });
});

describe('NoopApprovalService', () => {
  it('returns a deterministic request id without dispatching', async () => {
    const service = new NoopApprovalService(() => '2026-03-09T00:00:00.000Z');
    const publication = await service.publish(request);

    expect(publication).toEqual({
      requestId: 'ideation:idea-review',
      publishedAt: '2026-03-09T00:00:00.000Z',
    });
  });
});
