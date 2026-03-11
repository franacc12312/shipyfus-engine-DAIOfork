import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track DB operations
const dbOps: { table: string; op: string; data?: any }[] = [];

// Dynamic HITL config — tests can override this
let mockHitlConfig: Record<string, unknown> = {
  enabled: false,
  gate_after_research: true,
  gate_after_ideation: true,
  gate_after_branding: true,
  gate_after_planning: true,
  gate_after_development: true, gate_after_deployment: false,
};

// Dynamic run metadata — tests can override this
let mockRunMetadata: Record<string, unknown> = {};

vi.mock('../services/db.js', () => {
  const chainable = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(async () => ({ data: { status: 'completed', output_context: { purchased: true }, metadata: { ...mockRunMetadata } }, error: null })),
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
            return {
              ...chainable,
              limit: vi.fn().mockImplementation(() => ({
                ...chainable,
                single: vi.fn().mockImplementation(async () => ({
                  data: { ...mockHitlConfig },
                  error: null,
                })),
              })),
            };
          }
          if (table === 'approval_requests') {
            return {
              ...chainable,
              single: vi.fn().mockImplementation(async () => ({
                data: null,
                error: { code: 'PGRST116' },
              })),
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
    GITHUB_TOKEN: 'github-token',
    GITHUB_ORG: 'TheDAIO',
    GITHUB_DEFAULT_REPO_PRIVATE: true,
    OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
    PORKBUN_API_KEY: 'pk1_test',
    PORKBUN_API_SECRET: 'sk1_test',
    TAVILY_API_KEY: '', // Empty = research skipped
  },
}));

// Mock @daio/brand
vi.mock('@daio/brand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@daio/brand')>();
  return {
    ...actual,
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
    verifyDomainOwnership: vi.fn().mockResolvedValue({
      verified: true,
      domain: 'testbrand.xyz',
      status: 'ACTIVE',
    }),
    configureDNSForVercel: vi.fn().mockResolvedValue({
      domain: 'testbrand.xyz',
      records: [
        { type: 'A', name: '@', content: '76.76.21.21', success: true },
        { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', success: true },
      ],
      allSuccess: true,
    }),
  };
});

// Mock @daio/social
vi.mock('@daio/social', () => ({
  postTweet: vi.fn().mockResolvedValue({
    status: 'posted',
    tweetId: '123456789',
    tweetUrl: 'https://x.com/i/status/123456789',
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
const { mockEnsureProductRepository } = vi.hoisted(() => ({
  mockEnsureProductRepository: vi.fn(),
}));

vi.mock('../agents/runner.js', () => ({
  AgentRunner: vi.fn().mockImplementation(() => ({
    runOnce: mockRunOnce,
    runLoop: mockRunLoop,
    destroy: mockDestroy,
    killAll: mockKillAll,
  })),
}));

vi.mock('../services/github.js', () => ({
  ensureProductRepository: mockEnsureProductRepository,
}));

// Mock fs
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  cpSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
}));

import { PipelineOrchestrator } from '../orchestrator/pipeline.js';
import { purchaseDomain, rankCandidates, configureDNSForVercel, verifyDomainOwnership } from '@daio/brand';

function setupDefaultMocks() {
  mockEnsureProductRepository.mockResolvedValue({
    owner: 'TheDAIO',
    name: 'testbrand-run1',
    repoUrl: 'https://github.com/TheDAIO/testbrand-run1',
    cloneUrl: 'https://github.com/TheDAIO/testbrand-run1.git',
    defaultBranch: 'main',
    isPrivate: true,
    commitSha: 'abc123def456',
    syncStatus: 'synced',
    syncedAt: '2026-03-11T17:00:00.000Z',
  });

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
}

describe('PipelineOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbOps.length = 0;
    mockRunMetadata = {};
    mockHitlConfig = {
      enabled: false,
      gate_after_ideation: true,
      gate_after_branding: true,
      gate_after_planning: true,
      gate_after_development: true, gate_after_deployment: false,
    };
    setupDefaultMocks();
  });

  it('creates run_stages for all 7 stages', async () => {
    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    const stageInserts = dbOps.filter((op) => op.table === 'run_stages' && op.op === 'insert');
    expect(stageInserts).toHaveLength(7);
    const stages = stageInserts.map((op) => op.data.stage);
    expect(stages).toEqual(['research', 'ideation', 'branding', 'planning', 'development', 'deployment', 'distribution']);
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
    expect(productInsert!.data.github_repo_url).toBe('https://github.com/TheDAIO/testbrand-run1');
    expect(productInsert!.data.github_repo_name).toBe('testbrand-run1');
    expect(productInsert!.data.github_sync_status).toBe('synced');
  });

  it('fails the run when GitHub repo sync fails', async () => {
    mockEnsureProductRepository.mockRejectedValueOnce(new Error('GitHub push failed'));

    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    const runFailure = dbOps.find((op) => op.table === 'runs' && op.op === 'update' && op.data?.status === 'failed');
    expect(runFailure).toBeDefined();

    const deploymentFailure = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data?.status === 'failed'
    );
    expect(deploymentFailure).toBeDefined();
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

  it('pauses after development when approval is required and does not deploy', async () => {
    mockHitlConfig.enabled = true;
    mockHitlConfig.gate_after_ideation = false;
    mockHitlConfig.gate_after_branding = false;
    mockHitlConfig.gate_after_planning = false;
    mockHitlConfig.gate_after_development = true;

    const orch = new PipelineOrchestrator('run-1');
    await orch.execute();

    expect(mockRunOnce).toHaveBeenCalledTimes(4);

    const approvalInsert = dbOps.find(
      (op) => op.table === 'approval_requests' && op.op === 'insert' && op.data?.stage === 'development'
    );
    expect(approvalInsert).toBeDefined();

    const awaitingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data?.status === 'awaiting_approval'
    );
    expect(awaitingUpdate).toBeDefined();

    const completedRunUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data?.status === 'completed'
    );
    expect(completedRunUpdate).toBeUndefined();

    const productInsert = dbOps.find((op) => op.table === 'products' && op.op === 'insert');
    expect(productInsert).toBeUndefined();
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

describe('PipelineOrchestrator — HITL branding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunMetadata = {};
    // clearAllMocks doesn't clear mockOnce queues — reset key mocks to avoid leftovers
    mockRunOnce.mockReset();
    mockRunLoop.mockReset();
    vi.mocked(rankCandidates).mockReset().mockResolvedValue([
      { rank: 1, name: 'TestBrand', domain: 'testbrand.xyz', tld: 'xyz', strategy: 'invented', price: 2, reasoning: 'Great name', score: 85, alternatives: [] },
    ]);
    vi.mocked(purchaseDomain).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz', status: 'purchased', price: 2, registrar: 'porkbun',
    });
    vi.mocked(verifyDomainOwnership).mockReset().mockResolvedValue({
      verified: true, domain: 'testbrand.xyz', status: 'ACTIVE',
    });
    vi.mocked(configureDNSForVercel).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz',
      records: [
        { type: 'A', name: '@', content: '76.76.21.21', success: true },
        { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', success: true },
      ],
      allSuccess: true,
    });
    dbOps.length = 0;
  });

  it('stores candidates without purchasing when HITL is enabled', async () => {
    mockHitlConfig = {
      enabled: true,
      gate_after_ideation: false,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    // Mock runOnce: ideation (1), branding prism (2), planning (3), deployment (4)
    // No CFO call since HITL pauses before purchase
    mockRunOnce
      .mockResolvedValueOnce({
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
      // Branding (Prism only — no CFO)
      .mockResolvedValueOnce({
        text: 'brand candidates',
        json: [
          { name: 'TestBrand', strategy: 'invented', reasoning: 'Great name' },
          { name: 'CoolApp', strategy: 'compound', reasoning: 'Descriptive' },
        ],
        cost: 0.05,
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

    mockRunLoop.mockResolvedValue({
      text: 'dev complete',
      json: null,
      cost: 1.5,
      iterations: 3,
      completed: true,
    });

    const orch = new PipelineOrchestrator('run-hitl');
    await orch.execute();

    // purchaseDomain should NOT have been called (HITL pauses before purchase)
    expect(purchaseDomain).not.toHaveBeenCalled();

    // Verify candidates stored in output_context
    const brandingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.output_context?.candidates
    );
    expect(brandingUpdate).toBeDefined();
    expect(brandingUpdate!.data.output_context.candidates).toHaveLength(1); // Only 1 result from rankCandidates mock
    expect(brandingUpdate!.data.output_context.candidates[0].domain).toBe('testbrand.xyz');
    expect(dbOps.some((op) => op.table === 'approval_requests' && op.op === 'insert')).toBe(true);
  });

  it('stores up to 3 candidates from recommendations', async () => {
    mockHitlConfig = {
      enabled: true,
      gate_after_ideation: false,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    // Override rankCandidates to return 4 results
    vi.mocked(rankCandidates).mockResolvedValueOnce([
      { rank: 1, name: 'Alpha', domain: 'alpha.xyz', tld: 'xyz', strategy: 'invented', price: 2, reasoning: 'First', score: 90, alternatives: [] },
      { rank: 2, name: 'Beta', domain: 'beta.io', tld: 'io', strategy: 'compound', price: 3, reasoning: 'Second', score: 80, alternatives: [] },
      { rank: 3, name: 'Gamma', domain: 'gamma.dev', tld: 'dev', strategy: 'metaphorical', price: 5, reasoning: 'Third', score: 70, alternatives: [] },
      { rank: 4, name: 'Delta', domain: 'delta.com', tld: 'com', strategy: 'descriptive', price: 10, reasoning: 'Fourth', score: 60, alternatives: [] },
    ]);

    mockRunOnce
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        text: 'brand candidates',
        json: [
          { name: 'Alpha', strategy: 'invented', reasoning: 'First' },
          { name: 'Beta', strategy: 'compound', reasoning: 'Second' },
          { name: 'Gamma', strategy: 'metaphorical', reasoning: 'Third' },
          { name: 'Delta', strategy: 'descriptive', reasoning: 'Fourth' },
        ],
        cost: 0.05,
      })
      .mockResolvedValueOnce({
        text: 'plan created',
        json: { planFilePath: 'thoughts/PLAN.md' },
        cost: 0.05,
      })
      .mockResolvedValueOnce({
        text: 'deployed',
        json: { deployUrl: 'https://test.vercel.app', status: 'deployed' },
        cost: 0.02,
      });

    mockRunLoop.mockResolvedValue({
      text: 'dev complete',
      json: null,
      cost: 1.5,
      iterations: 3,
      completed: true,
    });

    const orch = new PipelineOrchestrator('run-hitl-3');
    await orch.execute();

    const brandingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.output_context?.candidates
    );
    expect(brandingUpdate).toBeDefined();
    // Should store exactly 3 (top 3), not all 4
    expect(brandingUpdate!.data.output_context.candidates).toHaveLength(3);
    expect(brandingUpdate!.data.output_context.candidates[0].domain).toBe('alpha.xyz');
    expect(brandingUpdate!.data.output_context.candidates[1].domain).toBe('beta.io');
    expect(brandingUpdate!.data.output_context.candidates[2].domain).toBe('gamma.dev');
  });

  it('candidates contain all DomainChoice fields', async () => {
    mockHitlConfig = {
      enabled: true,
      gate_after_ideation: false,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    mockRunOnce
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        text: 'brand candidates',
        json: [{ name: 'TestBrand', strategy: 'invented', reasoning: 'Great name' }],
        cost: 0.05,
      })
      .mockResolvedValueOnce({ text: 'plan', json: {}, cost: 0.05 })
      .mockResolvedValueOnce({ text: 'deployed', json: { deployUrl: null, status: 'deployed' }, cost: 0.02 });

    mockRunLoop.mockResolvedValue({ text: 'dev', json: null, cost: 1.5, iterations: 3, completed: true });

    const orch = new PipelineOrchestrator('run-hitl-fields');
    await orch.execute();

    const brandingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.output_context?.candidates
    );
    expect(brandingUpdate).toBeDefined();
    const candidate = brandingUpdate!.data.output_context.candidates[0];

    // Verify all DomainChoice fields are present
    expect(candidate).toHaveProperty('domain');
    expect(candidate).toHaveProperty('name');
    expect(candidate).toHaveProperty('price');
    expect(candidate).toHaveProperty('tld');
    expect(candidate).toHaveProperty('strategy');
    expect(candidate).toHaveProperty('reasoning');
    expect(candidate).toHaveProperty('score');
    // Should NOT have BrandRecommendation-specific fields
    expect(candidate).not.toHaveProperty('rank');
    expect(candidate).not.toHaveProperty('alternatives');
  });

  it('does not set domain_name on run when HITL is enabled', async () => {
    mockHitlConfig = {
      enabled: true,
      gate_after_ideation: false,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    mockRunOnce
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        text: 'brand candidates',
        json: [{ name: 'TestBrand', strategy: 'invented', reasoning: 'Great name' }],
        cost: 0.05,
      })
      .mockResolvedValueOnce({ text: 'plan', json: {}, cost: 0.05 })
      .mockResolvedValueOnce({ text: 'deployed', json: { deployUrl: null, status: 'deployed' }, cost: 0.02 });

    mockRunLoop.mockResolvedValue({ text: 'dev', json: null, cost: 1.5, iterations: 3, completed: true });

    const orch = new PipelineOrchestrator('run-hitl-no-domain');
    await orch.execute();

    // domain_name should NOT be set on the run (no purchase happened)
    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name
    );
    expect(domainUpdate).toBeUndefined();
  });

  it('handles fewer than 3 candidates gracefully', async () => {
    mockHitlConfig = {
      enabled: true,
      gate_after_ideation: false,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    // rankCandidates returns only 2 results
    vi.mocked(rankCandidates).mockResolvedValueOnce([
      { rank: 1, name: 'Alpha', domain: 'alpha.xyz', tld: 'xyz', strategy: 'invented', price: 2, reasoning: 'First', score: 90, alternatives: [] },
      { rank: 2, name: 'Beta', domain: 'beta.io', tld: 'io', strategy: 'compound', price: 3, reasoning: 'Second', score: 80, alternatives: [] },
    ]);

    mockRunOnce
      .mockResolvedValueOnce({
        text: 'ideation result',
        json: {
          productName: 'TestProduct', workingTitle: 'TestProduct',
          productDescription: 'A test product', targetUser: 'devs',
          problemStatement: 'testing', coreFunctionality: ['f1'],
          technicalRequirements: 'ts',
          suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: [] },
          mvpScope: 'basic', successCriteria: ['works'], uniqueValue: 'unique',
        },
        cost: 0.1,
      })
      .mockResolvedValueOnce({ text: 'brand candidates', json: [{ name: 'Alpha', strategy: 'invented', reasoning: 'First' }, { name: 'Beta', strategy: 'compound', reasoning: 'Second' }], cost: 0.05 })
      .mockResolvedValueOnce({ text: 'plan', json: {}, cost: 0.05 })
      .mockResolvedValueOnce({ text: 'deployed', json: { deployUrl: null, status: 'deployed' }, cost: 0.02 });

    mockRunLoop.mockResolvedValue({ text: 'dev', json: null, cost: 1.5, iterations: 3, completed: true });

    const orch = new PipelineOrchestrator('run-hitl-2cand');
    await orch.execute();

    const brandingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.output_context?.candidates
    );
    expect(brandingUpdate).toBeDefined();
    // Should store exactly 2 (all available), not error
    expect(brandingUpdate!.data.output_context.candidates).toHaveLength(2);
    expect(brandingUpdate!.data.output_context.candidates[0].domain).toBe('alpha.xyz');
    expect(brandingUpdate!.data.output_context.candidates[1].domain).toBe('beta.io');
  });

  it('handles 0 candidates (empty recommendations)', async () => {
    mockHitlConfig = {
      enabled: true,
      gate_after_ideation: false,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    // rankCandidates returns empty
    vi.mocked(rankCandidates).mockResolvedValueOnce([]);

    mockRunOnce
      .mockResolvedValueOnce({
        text: 'ideation result',
        json: {
          productName: 'TestProduct', workingTitle: 'TestProduct',
          productDescription: 'A test product', targetUser: 'devs',
          problemStatement: 'testing', coreFunctionality: ['f1'],
          technicalRequirements: 'ts',
          suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: [] },
          mvpScope: 'basic', successCriteria: ['works'], uniqueValue: 'unique',
        },
        cost: 0.1,
      })
      // Prism returns candidates, but rankCandidates returns [] (all unavailable)
      .mockResolvedValueOnce({ text: 'brand candidates', json: [{ name: 'Unavailable', strategy: 'invented', reasoning: 'Taken' }], cost: 0.05 })
      .mockResolvedValueOnce({ text: 'plan', json: {}, cost: 0.05 })
      .mockResolvedValueOnce({ text: 'deployed', json: { deployUrl: null, status: 'deployed' }, cost: 0.02 });

    mockRunLoop.mockResolvedValue({ text: 'dev', json: null, cost: 1.5, iterations: 3, completed: true });

    const orch = new PipelineOrchestrator('run-hitl-0cand');
    await orch.execute();

    const brandingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.output_context?.candidates
    );
    expect(brandingUpdate).toBeDefined();
    // Should store empty candidates array (frontend shows error state)
    expect(brandingUpdate!.data.output_context.candidates).toHaveLength(0);
  });

  it('HITL disabled: purchases domain as before', async () => {
    mockHitlConfig = {
      enabled: false,
      gate_after_ideation: true,
      gate_after_branding: true,
      gate_after_planning: true,
      gate_after_development: true, gate_after_deployment: false,
    };

    setupDefaultMocks();

    const orch = new PipelineOrchestrator('run-no-hitl');
    await orch.execute();

    // purchaseDomain SHOULD have been called
    expect(purchaseDomain).toHaveBeenCalledWith('testbrand.xyz', {
      apiKey: 'pk1_test',
      apiSecret: 'sk1_test',
    });

    // domain_name should be set
    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name === 'testbrand.xyz'
    );
    expect(domainUpdate).toBeDefined();
  });
});

describe('PipelineOrchestrator — purchase failure handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunOnce.mockReset();
    mockRunLoop.mockReset();
    dbOps.length = 0;
    mockRunMetadata = {};
    mockHitlConfig = {
      enabled: false,
      gate_after_ideation: false,
      gate_after_branding: false,
      gate_after_planning: false,
      gate_after_development: false, gate_after_deployment: false,
    };

    vi.mocked(rankCandidates).mockReset().mockResolvedValue([
      { rank: 1, name: 'TestBrand', domain: 'testbrand.xyz', tld: 'xyz', strategy: 'invented', price: 2, reasoning: 'Great name', score: 85, alternatives: [] },
    ]);
  });

  function setupMocksForBrandingTest() {
    mockRunOnce
      // Ideation
      .mockResolvedValueOnce({
        text: 'ideation result',
        json: {
          productName: 'TestProduct', workingTitle: 'TestProduct',
          productDescription: 'A test product', targetUser: 'devs',
          problemStatement: 'testing', coreFunctionality: ['f1'],
          technicalRequirements: 'ts',
          suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: [] },
          mvpScope: 'basic', successCriteria: ['works'], uniqueValue: 'unique',
        },
        cost: 0.1,
      })
      // Branding Prism
      .mockResolvedValueOnce({
        text: 'brand candidates',
        json: [{ name: 'TestBrand', strategy: 'invented', reasoning: 'Great name' }],
        cost: 0.05,
      })
      // CFO (only called if purchase succeeds)
      .mockResolvedValueOnce({ text: 'cfo narration', json: {}, cost: 0.01 })
      // Planning
      .mockResolvedValueOnce({ text: 'plan', json: { planFilePath: 'thoughts/PLAN.md' }, cost: 0.05 })
      // Deployment
      .mockResolvedValueOnce({ text: 'deployed', json: { deployUrl: 'https://test.vercel.app', status: 'deployed' }, cost: 0.02 });

    mockRunLoop.mockResolvedValue({ text: 'dev', json: null, cost: 1.5, iterations: 3, completed: true });
  }

  it('does not store domain_name when purchase fails', async () => {
    vi.mocked(purchaseDomain).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz', status: 'failed', price: 0, registrar: 'porkbun', error: 'Cost must be a valid integer.',
    });
    vi.mocked(verifyDomainOwnership).mockReset();
    vi.mocked(configureDNSForVercel).mockReset();

    setupMocksForBrandingTest();

    const orch = new PipelineOrchestrator('run-purchase-fail');
    await orch.execute();

    // domain_name should NOT be set on run
    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name
    );
    expect(domainUpdate).toBeUndefined();

    // verifyDomainOwnership should NOT have been called
    expect(verifyDomainOwnership).not.toHaveBeenCalled();
    // configureDNSForVercel should NOT have been called
    expect(configureDNSForVercel).not.toHaveBeenCalled();
  });

  it('does not store domain_name when verification fails', async () => {
    vi.mocked(purchaseDomain).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz', status: 'purchased', price: 2, registrar: 'porkbun',
    });
    vi.mocked(verifyDomainOwnership).mockReset().mockResolvedValue({
      verified: false, domain: 'testbrand.xyz', error: 'Domain not found in account after purchase',
    });
    vi.mocked(configureDNSForVercel).mockReset();

    setupMocksForBrandingTest();

    const orch = new PipelineOrchestrator('run-verify-fail');
    await orch.execute();

    // domain_name should NOT be set on run
    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name
    );
    expect(domainUpdate).toBeUndefined();

    // configureDNSForVercel should NOT have been called
    expect(configureDNSForVercel).not.toHaveBeenCalled();
  });

  it('logs purchase failure to dashboard', async () => {
    vi.mocked(purchaseDomain).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz', status: 'failed', price: 0, registrar: 'porkbun', error: 'Insufficient funds',
    });
    vi.mocked(verifyDomainOwnership).mockReset();
    vi.mocked(configureDNSForVercel).mockReset();

    setupMocksForBrandingTest();

    const orch = new PipelineOrchestrator('run-log-fail');
    await orch.execute();

    // Should have inserted a log about purchase failure
    const logInsert = dbOps.find(
      (op) => op.table === 'logs' && op.op === 'insert' && op.data.content?.includes('purchase failed')
    );
    expect(logInsert).toBeDefined();
    expect(logInsert!.data.content).toContain('Insufficient funds');
  });

  it('verifies domain ownership after purchase succeeds', async () => {
    vi.mocked(purchaseDomain).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz', status: 'purchased', price: 2, registrar: 'porkbun',
    });
    vi.mocked(verifyDomainOwnership).mockReset().mockResolvedValue({
      verified: true, domain: 'testbrand.xyz', status: 'ACTIVE',
    });
    vi.mocked(configureDNSForVercel).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz',
      records: [
        { type: 'A', name: '@', content: '76.76.21.21', success: true },
        { type: 'CNAME', name: 'www', content: 'cname.vercel-dns.com', success: true },
      ],
      allSuccess: true,
    });

    setupMocksForBrandingTest();

    const orch = new PipelineOrchestrator('run-verify-ok');
    await orch.execute();

    // verifyDomainOwnership should have been called
    expect(verifyDomainOwnership).toHaveBeenCalledWith('testbrand.xyz', {
      apiKey: 'pk1_test',
      apiSecret: 'sk1_test',
    });

    // domain_name SHOULD be set
    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name === 'testbrand.xyz'
    );
    expect(domainUpdate).toBeDefined();
  });

  it('skips real purchase when mockDomainPurchase is set in metadata', async () => {
    vi.mocked(purchaseDomain).mockReset();
    vi.mocked(verifyDomainOwnership).mockReset();
    vi.mocked(configureDNSForVercel).mockReset();

    // Set mock metadata so pipeline reads _mockDomainPurchase
    mockRunMetadata = { _mockDomainPurchase: true };

    setupMocksForBrandingTest();

    const orch = new PipelineOrchestrator('run-mock-purchase');
    await orch.execute();

    // Real purchase functions should NOT have been called
    expect(purchaseDomain).not.toHaveBeenCalled();
    expect(verifyDomainOwnership).not.toHaveBeenCalled();
    expect(configureDNSForVercel).not.toHaveBeenCalled();

    // Domain should still be set (mock purchase is treated as verified)
    const domainUpdate = dbOps.find(
      (op) => op.table === 'runs' && op.op === 'update' && op.data.domain_name === 'testbrand.xyz'
    );
    expect(domainUpdate).toBeDefined();

    // Should have a [MOCK] log entry
    const mockLog = dbOps.find(
      (op) => op.table === 'logs' && op.op === 'insert' && op.data.content?.includes('[MOCK]')
    );
    expect(mockLog).toBeDefined();
  });

  it('stores purchaseError in output_context when purchase fails', async () => {
    vi.mocked(purchaseDomain).mockReset().mockResolvedValue({
      domain: 'testbrand.xyz', status: 'failed', price: 0, registrar: 'porkbun', error: 'Cost must be a valid integer.',
    });
    vi.mocked(verifyDomainOwnership).mockReset();
    vi.mocked(configureDNSForVercel).mockReset();

    setupMocksForBrandingTest();

    const orch = new PipelineOrchestrator('run-ctx-error');
    await orch.execute();

    // Find branding stage update with output_context
    const brandingUpdate = dbOps.find(
      (op) => op.table === 'run_stages' && op.op === 'update' && op.data.output_context?.purchaseError
    );
    expect(brandingUpdate).toBeDefined();
    expect(brandingUpdate!.data.output_context.purchased).toBe(false);
    expect(brandingUpdate!.data.output_context.purchaseError).toContain('Cost must be a valid integer.');
  });
});
