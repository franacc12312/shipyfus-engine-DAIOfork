import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track DB operations
const dbOps: { table: string; op: string; data?: any }[] = [];

vi.mock('../services/db.js', () => {
  const chainable = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [{ id: 'cfo-agent-id' }] }),
  };

  return {
    db: {
      from: (table: string) => ({
        insert: (data: any) => {
          dbOps.push({ table, op: 'insert', data });
          return { ...chainable, select: () => ({ ...chainable, single: () => Promise.resolve({ data: { id: 'prod-1' }, error: null }) }) };
        },
        update: (data: any) => {
          dbOps.push({ table, op: 'update', data });
          return chainable;
        },
        select: () => {
          dbOps.push({ table, op: 'select' });
          if (table === 'constraints') {
            return {
              ...chainable,
              then: (resolve: any) => resolve({
                data: [
                  { department: 'research', config: { enabled: false } },
                  { department: 'ideation', config: { platform: 'web', audience: 'consumer', complexity: 'simple' } },
                  { department: 'branding', config: { max_domain_price: 15, preferred_tlds: ['xyz'] } },
                  { department: 'planning', config: { max_phases: 5, require_tests: true, max_files_per_phase: 10 } },
                  { department: 'development', config: { language: 'typescript', framework: 'react', max_files: 20, max_iterations: 3, max_budget_usd: 5 } },
                  { department: 'deployment', config: { provider: 'vercel', auto_deploy: true } },
                ],
                error: null,
              }),
            };
          }
          if (table === 'hitl_config') {
            // Return HITL disabled by default (gates are skipped in existing tests)
            return {
              ...chainable,
              limit: vi.fn().mockReturnValue({
                ...chainable,
                single: vi.fn().mockResolvedValue({
                  data: { enabled: false, gate_after_research: true, gate_after_ideation: true, gate_after_planning: true, gate_after_development: true },
                  error: null,
                }),
              }),
            };
          }
          return chainable;
        },
      }),
    },
  };
});

vi.mock('../env.js', () => ({
  env: {
    VERCEL_TOKEN: 'test-token',
    OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
    PORKBUN_API_KEY: 'pk1_test',
    PORKBUN_API_SECRET: 'sk1_test',
    TAVILY_API_KEY: '', // Empty = research skipped
  },
}));

// Mock @daio/brand
vi.mock('@daio/brand', () => ({
  rankCandidates: vi.fn().mockResolvedValue([
    {
      rank: 1,
      name: 'TestBrand',
      domain: 'testbrand.xyz',
      tld: 'xyz',
      strategy: 'invented',
      price: 2,
      reasoning: 'Great name',
      score: 85,
      alternatives: [],
    },
  ]),
  purchaseDomain: vi.fn().mockResolvedValue({
    domain: 'testbrand.xyz',
    status: 'purchased',
    price: 2,
    registrar: 'porkbun',
  }),
  configureDNSForVercel: vi.fn().mockResolvedValue({
    domain: 'testbrand.xyz',
    records: [
      { type: 'A', name: '@', content: '76.76.21.21', success: true },
      { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', success: true },
    ],
    allSuccess: true,
  }),
}));

// Mock @daio/research
vi.mock('@daio/research', () => ({
  ResearchService: vi.fn().mockImplementation(() => ({
    addSource: vi.fn(),
    gather: vi.fn().mockResolvedValue({
      signals: [],
      sourcesUsed: [],
      totalSignals: 0,
      sourceResults: [],
    }),
  })),
  TavilySource: vi.fn(),
  ProductHuntSource: vi.fn(),
  HackerNewsSource: vi.fn(),
  RedditSource: vi.fn(),
}));

// Mock AgentRunner
const mockRunOnce = vi.fn();
const mockRunLoop = vi.fn();
const mockDestroy = vi.fn();
const mockKillAll = vi.fn();

vi.mock('../agents/runner.js', () => ({
  AgentRunner: vi.fn().mockImplementation(() => ({
    runOnce: mockRunOnce,
    runLoop: mockRunLoop,
    destroy: mockDestroy,
    killAll: mockKillAll,
  })),
}));

// Mock fs
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

import { PipelineOrchestrator } from '../orchestrator/pipeline.js';

describe('PipelineOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbOps.length = 0;

    // Default mock: ideation returns PRD
    mockRunOnce.mockResolvedValueOnce({
      text: 'ideation result',
      json: {
        productName: 'TestProduct',
        workingTitle: 'TestProduct',
        productDescription: 'A test product',
        targetUser: 'devs',
        problemStatement: 'testing',
        coreFunctionality: ['f1'],
        technicalRequirements: 'ts',
        suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: [] },
        mvpScope: 'basic',
        successCriteria: ['works'],
        uniqueValue: 'unique',
      },
      cost: 0.1,
    })
    // Branding (Prism): returns brand candidates
    .mockResolvedValueOnce({
      text: 'brand candidates',
      json: [
        { name: 'TestBrand', strategy: 'invented', reasoning: 'Great name' },
        { name: 'CoolApp', strategy: 'compound', reasoning: 'Descriptive' },
      ],
      cost: 0.05,
    })
    // Branding (CFO): narration
    .mockResolvedValueOnce({
      text: 'domain purchased',
      json: { domain: 'testbrand.xyz', price: 2, registrar: 'porkbun', status: 'purchased' },
      cost: 0.01,
    })
    // Planning
    .mockResolvedValueOnce({
      text: 'plan created',
      json: { planFilePath: 'thoughts/PLAN.md', phases: ['Phase 1'], totalTasks: 5 },
      cost: 0.05,
    })
    // Deployment
    .mockResolvedValueOnce({
      text: 'deployed',
      json: { deployUrl: 'https://test.vercel.app', provider: 'vercel', status: 'deployed' },
      cost: 0.02,
    });

    // Development loop
    mockRunLoop.mockResolvedValue({
      text: 'dev complete',
      json: null,
      cost: 1.5,
      iterations: 3,
      completed: true,
    });
  });

  it('creates run_stages for all 6 stages', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    const stageInserts = dbOps.filter((op) => op.table === 'run_stages' && op.op === 'insert');
    expect(stageInserts).toHaveLength(6);
    const stages = stageInserts.map((op) => op.data.stage);
    expect(stages).toEqual(['research', 'ideation', 'branding', 'planning', 'development', 'deployment']);
  });

  it('skips research when disabled (no TAVILY_API_KEY)', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    // Research should be marked as skipped
    const researchSkip = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.status === 'skipped'
    );
    expect(researchSkip).toBeDefined();
  });

  it('updates run status to running then completed', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    const runUpdates = dbOps.filter((op) => op.table === 'runs' && op.op === 'update');
    const statuses = runUpdates.map((op) => op.data.status).filter(Boolean);
    expect(statuses[0]).toBe('running');
    expect(statuses[statuses.length - 1]).toBe('completed');
  });

  it('handles stage failure and marks run failed', async () => {
    mockRunOnce.mockReset();
    mockRunOnce.mockRejectedValueOnce(new Error('Ideation failed'));

    const orch = new PipelineOrchestrator('run-fail');
    await orch.execute();

    const runUpdates = dbOps.filter((op) => op.table === 'runs' && op.op === 'update');
    const failUpdate = runUpdates.find((op) => op.data.status === 'failed');
    expect(failUpdate).toBeDefined();
    expect(failUpdate!.data.error).toContain('Ideation failed');
  });

  it('calls runOnce for ideation, branding (x2), planning, deployment (research skipped)', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    // Research is skipped (no API key), so 5 runOnce calls: ideation, branding prism, branding cfo, planning, deployment
    expect(mockRunOnce).toHaveBeenCalledTimes(5);
  });

  it('calls runLoop for development', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    expect(mockRunLoop).toHaveBeenCalledTimes(1);
    const loopCall = mockRunLoop.mock.calls[0];
    expect(loopCall[1].stage).toBe('development');
  });

  it('registers product on success', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    const productInsert = dbOps.find((op) => op.table === 'products' && op.op === 'insert');
    expect(productInsert).toBeDefined();
    expect(productInsert!.data.name).toBe('TestBrand'); // Branding stage renames from TestProduct
    expect(productInsert!.data.deploy_url).toBe('https://test.vercel.app');
    expect(productInsert!.data.domain_name).toBe('testbrand.xyz');
  });

  it('calls destroy on runner when done', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it('runs branding stage after ideation', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    // Verify branding stage was updated to completed
    const brandingUpdates = dbOps.filter(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.status === 'completed'
    );
    // Should have completed stages for: ideation, branding, planning, development, deployment
    expect(brandingUpdates.length).toBeGreaterThanOrEqual(3);
  });

  it('updates domain_name on run after branding', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name
    );
    expect(domainUpdate).toBeDefined();
    expect(domainUpdate!.data.domain_name).toBe('testbrand.xyz');
  });

  it('handles branding failure and marks run failed', async () => {
    mockRunOnce.mockReset();
    // Ideation succeeds
    mockRunOnce.mockResolvedValueOnce({
      text: 'ideation result',
      json: {
        productName: 'TestProduct',
        workingTitle: 'TestProduct',
        productDescription: 'A test product',
        targetUser: 'devs',
        problemStatement: 'testing',
        coreFunctionality: ['f1'],
        technicalRequirements: 'ts',
        suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: [] },
        mvpScope: 'basic',
        successCriteria: ['works'],
        uniqueValue: 'unique',
      },
      cost: 0.1,
    });
    // Branding fails
    mockRunOnce.mockRejectedValueOnce(new Error('Branding failed'));

    const orch = new PipelineOrchestrator('run-fail');
    await orch.execute();

    const failUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.status === 'failed'
    );
    expect(failUpdate).toBeDefined();
  });
});
