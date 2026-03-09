import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track DB operations
const dbOps: { table: string; op: string; data?: any; filters?: any }[] = [];

// Configurable mock responses
let hitlConfig = { enabled: false, gate_after_research: true, gate_after_ideation: true, gate_after_branding: true, gate_after_planning: true, gate_after_development: true, gate_after_deployment: false };
let stageStatusResponses: Record<string, string> = {};
let pollCount = 0;

vi.mock('../services/db.js', () => {
  const makeChainable = () => {
    const state: { table: string; filters: Record<string, string> } = { table: '', filters: {} };
    const chain: any = {
      eq: vi.fn((col: string, val: string) => { state.filters[col] = val; return chain; }),
      in: vi.fn(() => chain),
      single: vi.fn(() => {
        if (state.table === 'hitl_config') {
          return Promise.resolve({ data: { ...hitlConfig }, error: null });
        }
        if (state.table === 'approval_requests') {
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        }
        if (state.table === 'run_stages' && state.filters.stage) {
          pollCount++;
          const status = stageStatusResponses[state.filters.stage] || 'awaiting_approval';
          return Promise.resolve({ data: { id: `stage-${state.filters.stage}`, status }, error: null });
        }
        if (state.table === 'constraints') {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
    };
    return { chain, state };
  };

  return {
    db: {
      from: (table: string) => {
        const { chain, state } = makeChainable();
        state.table = table;
        return {
          insert: (data: any) => {
            dbOps.push({ table, op: 'insert', data });
            return { ...chain, select: () => ({ ...chain, single: () => Promise.resolve({ data: { id: 'prod-1' }, error: null }) }) };
          },
          update: (data: any) => {
            dbOps.push({ table, op: 'update', data });
            return chain;
          },
          select: (...args: any[]) => {
            dbOps.push({ table, op: 'select' });
            if (table === 'constraints') {
              return {
                ...chain,
                then: (resolve: any) => resolve({
                  data: [
                    { department: 'research', config: { enabled: false } },
                    { department: 'ideation', config: { platform: 'web' } },
                    { department: 'branding', config: {} },
                    { department: 'planning', config: {} },
                    { department: 'development', config: { max_iterations: 3 } },
                    { department: 'deployment', config: {} },
                  ],
                  error: null,
                }),
              };
            }
            // For run_stages select('*'), return stages as an array
            if (table === 'run_stages') {
              return {
                ...chain,
                eq: vi.fn((col: string, val: string) => {
                  state.filters[col] = val;
                  // If this is the full stages query (for runPipeline), return all stages
                  if (col === 'run_id' && !state.filters.stage) {
                    return {
                      ...chain,
                      eq: vi.fn((c: string, v: string) => {
                        state.filters[c] = v;
                        return chain;
                      }),
                      then: (resolve: any) => resolve({
                        data: [
                          { stage: 'research', status: 'pending', output_context: null },
                          { stage: 'ideation', status: 'pending', output_context: null },
                          { stage: 'branding', status: 'pending', output_context: null },
                          { stage: 'planning', status: 'pending', output_context: null },
                          { stage: 'development', status: 'pending', output_context: null },
                          { stage: 'deployment', status: 'pending', output_context: null },
                        ],
                        error: null,
                      }),
                    };
                  }
                  return chain;
                }),
              };
            }
            return chain;
          },
        };
      },
    },
  };
});

vi.mock('../env.js', () => ({
  env: {
    VERCEL_TOKEN: 'test-token',
    OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
    PORKBUN_API_KEY: 'pk1_test',
    PORKBUN_API_SECRET: 'sk1_test',
    TAVILY_API_KEY: '',
  },
}));

vi.mock('@daio/social', () => ({
  postTweet: vi.fn().mockResolvedValue({ status: 'posted', tweetId: '1', tweetUrl: 'https://x.com/i/status/1' }),
}));

vi.mock('@daio/research', () => ({
  ResearchService: vi.fn().mockImplementation(() => ({
    addSource: vi.fn(),
    gather: vi.fn().mockResolvedValue({ signals: [], sourcesUsed: [], totalSignals: 0, sourceResults: [] }),
  })),
  TavilySource: vi.fn(),
  ProductHuntSource: vi.fn(),
  HackerNewsSource: vi.fn(),
  RedditSource: vi.fn(),
}));

vi.mock('@daio/brand', () => ({
  rankCandidates: vi.fn().mockResolvedValue([]),
  purchaseDomain: vi.fn().mockResolvedValue({ domain: 'test.xyz', status: 'purchased', price: 2, registrar: 'porkbun' }),
  configureDNSForVercel: vi.fn().mockResolvedValue({ domain: 'test.xyz', records: [], allSuccess: true }),
}));

vi.mock('../agents/runner.js', () => ({
  AgentRunner: vi.fn().mockImplementation(() => ({
    runOnce: vi.fn(),
    runLoop: vi.fn(),
    destroy: vi.fn(),
    killAll: vi.fn(),
  })),
}));

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

import { PipelineOrchestrator } from '../orchestrator/pipeline.js';

describe('checkApprovalGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbOps.length = 0;
    pollCount = 0;
    hitlConfig = { enabled: false, gate_after_research: true, gate_after_ideation: true, gate_after_branding: true, gate_after_planning: true, gate_after_development: true, gate_after_deployment: false };
    stageStatusResponses = {};
  });

  it('skips gate when HITL is disabled', async () => {
    hitlConfig.enabled = false;
    const orch = new PipelineOrchestrator('run-1');
    await orch.checkApprovalGate('ideation');
    // Should return immediately, no stage status update
    const stageUpdates = dbOps.filter((op) => op.table === 'run_stages' && op.op === 'update');
    expect(stageUpdates).toHaveLength(0);
  });

  it('skips gate when specific gate is disabled', async () => {
    hitlConfig.enabled = true;
    hitlConfig.gate_after_ideation = false;
    const orch = new PipelineOrchestrator('run-1');
    await orch.checkApprovalGate('ideation');
    const stageUpdates = dbOps.filter((op) => op.table === 'run_stages' && op.op === 'update');
    expect(stageUpdates).toHaveLength(0);
  });

  it('sets stage to awaiting_approval when gate is enabled', async () => {
    hitlConfig.enabled = true;
    hitlConfig.gate_after_ideation = true;
    // First poll returns awaiting_approval, second poll returns completed
    let callCount = 0;
    stageStatusResponses.ideation = 'completed'; // Will be returned on poll

    const orch = new PipelineOrchestrator('run-1');
    await orch.checkApprovalGate('ideation');

    const stageUpdates = dbOps.filter(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data?.status === 'awaiting_approval'
    );
    expect(stageUpdates.length).toBeGreaterThanOrEqual(1);
    const approvalInserts = dbOps.filter((op) => op.table === 'approval_requests' && op.op === 'insert');
    expect(approvalInserts).toHaveLength(1);
  });

  it('continues when stage is approved (status=completed)', async () => {
    hitlConfig.enabled = true;
    stageStatusResponses.planning = 'completed';

    const orch = new PipelineOrchestrator('run-1');
    await orch.checkApprovalGate('planning');

    // Should have logged approval
    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    expect(logInserts.length).toBeGreaterThanOrEqual(1);
    expect(logInserts.some((op) => op.data?.content?.includes('Approval received'))).toBe(true);
  });

  it('throws RetryStageError when stage is rejected with retry (status=pending)', async () => {
    hitlConfig.enabled = true;
    stageStatusResponses.ideation = 'pending';

    const orch = new PipelineOrchestrator('run-1');
    await expect(orch.checkApprovalGate('ideation')).rejects.toThrow('Retry requested');
  });

  it('throws error when stage is rejected with cancel (status=cancelled)', async () => {
    hitlConfig.enabled = true;
    stageStatusResponses.development = 'cancelled';

    const orch = new PipelineOrchestrator('run-1');
    await expect(orch.checkApprovalGate('development')).rejects.toThrow('rejected');
  });

  it('respects cancelled flag during polling', async () => {
    hitlConfig.enabled = true;
    stageStatusResponses.ideation = 'awaiting_approval'; // Will keep polling

    const orch = new PipelineOrchestrator('run-1');
    // Cancel after a short delay
    setTimeout(() => orch.cancel(), 100);

    await expect(orch.checkApprovalGate('ideation')).rejects.toThrow('cancelled');
  });
});
