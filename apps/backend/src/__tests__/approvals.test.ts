import { beforeEach, describe, expect, it, vi } from 'vitest';

const approvalRequests: Record<string, unknown>[] = [];

function matchesFilters(row: Record<string, unknown>, filters: Record<string, unknown>): boolean {
  return Object.entries(filters).every(([key, value]) => row[key] === value);
}

function pickColumns(row: Record<string, unknown>, columns?: string): Record<string, unknown> {
  if (!columns) {
    return { ...row };
  }

  const keys = columns.split(',').map((column) => column.trim()).filter(Boolean);
  return Object.fromEntries(keys.map((key) => [key, row[key]]));
}

vi.mock('../services/db.js', () => {
  function createSelectChain(table: string, columns?: string) {
    const filters: Record<string, unknown> = {};

    const chain: any = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      }),
      single: vi.fn(async () => {
        if (table !== 'approval_requests') {
          return { data: null, error: null };
        }

        const row = approvalRequests.find((candidate) => matchesFilters(candidate, filters));
        if (!row) {
          return { data: null, error: { code: 'PGRST116' } };
        }

        return { data: pickColumns(row, columns), error: null };
      }),
    };

    return chain;
  }

  function createUpdateChain(table: string, data: Record<string, unknown>) {
    const filters: Record<string, unknown> = {};

    const chain: any = {
      eq: vi.fn((column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      }),
      then: (resolve: (value: { data: null; error: null }) => unknown) => {
        if (table === 'approval_requests') {
          for (const row of approvalRequests) {
            if (matchesFilters(row, filters)) {
              Object.assign(row, data);
            }
          }
        }

        return Promise.resolve(resolve({ data: null, error: null }));
      },
    };

    return chain;
  }

  return {
    db: {
      from: (table: string) => ({
        select: (columns?: string) => createSelectChain(table, columns),
        insert: (data: Record<string, unknown>) => ({
          select: (columns?: string) => ({
            single: async () => {
              const row = {
                id: `approval-${approvalRequests.length + 1}`,
                ...data,
              };
              approvalRequests.push(row);
              return { data: pickColumns(row, columns), error: null };
            },
          }),
        }),
        update: (data: Record<string, unknown>) => createUpdateChain(table, data),
      }),
    },
  };
});

import {
  DatabaseApprovalService,
  buildStageApprovalRequest,
  resolveAllPendingApprovalRequests,
  resolvePendingApprovalRequest,
} from '../services/approvals.js';

describe('approvals service', () => {
  beforeEach(() => {
    approvalRequests.length = 0;
  });

  it('publishes a pending approval request', async () => {
    const service = new DatabaseApprovalService('run-1', () => '2026-03-09T16:00:00.000Z');

    const publication = await service.publish(
      buildStageApprovalRequest('ideation', { productName: 'Test Product' }),
    );

    expect(publication).toEqual({
      requestId: 'approval-1',
      publishedAt: '2026-03-09T16:00:00.000Z',
    });
    expect(approvalRequests).toHaveLength(1);
    expect(approvalRequests[0]).toMatchObject({
      run_id: 'run-1',
      stage: 'ideation',
      request_key: 'human-review',
      status: 'pending',
    });
  });

  it('reuses the existing pending request for the same run and stage', async () => {
    approvalRequests.push({
      id: 'approval-existing',
      run_id: 'run-1',
      stage: 'branding',
      request_key: 'human-review',
      status: 'pending',
      created_at: '2026-03-09T16:01:00.000Z',
    });

    const service = new DatabaseApprovalService('run-1', () => '2026-03-09T16:02:00.000Z');
    const publication = await service.publish(buildStageApprovalRequest('branding', { candidates: [] }));

    expect(publication).toEqual({
      requestId: 'approval-existing',
      publishedAt: '2026-03-09T16:01:00.000Z',
    });
    expect(approvalRequests).toHaveLength(1);
  });

  it('resolves a single pending approval request with the selected outcome', async () => {
    approvalRequests.push({
      id: 'approval-1',
      run_id: 'run-1',
      stage: 'branding',
      request_key: 'human-review',
      status: 'pending',
    });

    const requestId = await resolvePendingApprovalRequest({
      runId: 'run-1',
      stage: 'branding',
      decision: { action: 'approve' },
      actorId: 'user-1',
      actorName: 'user-1',
      provider: 'dashboard',
      resolvedAt: '2026-03-09T16:03:00.000Z',
    });

    expect(requestId).toBe('approval-1');
    expect(approvalRequests[0]).toMatchObject({
      status: 'resolved',
      outcome: 'approved',
      actor_id: 'user-1',
      provider: 'dashboard',
      resolved_at: '2026-03-09T16:03:00.000Z',
    });
  });

  it('resolves all pending requests for a run when the pipeline is cancelled', async () => {
    approvalRequests.push(
      {
        id: 'approval-1',
        run_id: 'run-1',
        stage: 'ideation',
        request_key: 'human-review',
        status: 'pending',
      },
      {
        id: 'approval-2',
        run_id: 'run-1',
        stage: 'planning',
        request_key: 'human-review',
        status: 'pending',
      },
      {
        id: 'approval-3',
        run_id: 'run-2',
        stage: 'ideation',
        request_key: 'human-review',
        status: 'pending',
      },
    );

    await resolveAllPendingApprovalRequests({
      runId: 'run-1',
      decision: { action: 'cancel' },
      reason: 'Cancelled from test',
      resolvedAt: '2026-03-09T16:04:00.000Z',
    });

    expect(approvalRequests[0]).toMatchObject({
      status: 'resolved',
      outcome: 'cancel',
      reason: 'Cancelled from test',
    });
    expect(approvalRequests[1]).toMatchObject({
      status: 'resolved',
      outcome: 'cancel',
    });
    expect(approvalRequests[2]).toMatchObject({
      status: 'pending',
    });
  });
});
