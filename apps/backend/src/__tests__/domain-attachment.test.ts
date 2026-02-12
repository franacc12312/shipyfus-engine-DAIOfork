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
              limit: vi.fn().mockReturnValue({
                ...chainable,
                single: vi.fn().mockResolvedValue({
                  data: { enabled: false },
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
    VERCEL_TOKEN: 'test-vercel-token',
    OWNER_USER_ID: '00000000-0000-0000-0000-000000000001',
    PORKBUN_API_KEY: 'pk1_test',
    PORKBUN_API_SECRET: 'sk1_test',
  },
}));

vi.mock('@daio/brand', () => ({
  rankCandidates: vi.fn().mockResolvedValue([
    { rank: 1, name: 'TestBrand', domain: 'testbrand.xyz', tld: 'xyz', strategy: 'invented', price: 2, reasoning: 'Great', score: 85, alternatives: [] },
  ]),
  purchaseDomain: vi.fn().mockResolvedValue({ domain: 'testbrand.xyz', status: 'purchased', price: 2, registrar: 'porkbun' }),
  configureDNSForVercel: vi.fn().mockResolvedValue({ domain: 'testbrand.xyz', records: [], allSuccess: true }),
}));

const mockAddDomain = vi.fn();
const mockGetDomainConfig = vi.fn();

vi.mock('../services/vercel.js', async () => {
  const actual = await vi.importActual('../services/vercel.js') as Record<string, unknown>;
  return {
    ...actual,
    addDomainToProject: (...args: any[]) => mockAddDomain(...args),
    getDomainConfig: (...args: any[]) => mockGetDomainConfig(...args),
  };
});

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

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
}));

import { PipelineOrchestrator } from '../orchestrator/pipeline.js';

function setupFullPipelineMocks(deployJson: Record<string, unknown>) {
  mockRunOnce
    // Ideation
    .mockResolvedValueOnce({
      text: 'ideation', cost: 0.1,
      json: {
        productName: 'TestProduct', workingTitle: 'TestProduct',
        productDescription: 'A test', targetUser: 'devs', problemStatement: 'test',
        coreFunctionality: ['f1'], technicalRequirements: 'ts',
        suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: [] },
        mvpScope: 'basic', successCriteria: ['works'], uniqueValue: 'unique',
      },
    })
    // Branding (Prism)
    .mockResolvedValueOnce({
      text: 'brands', cost: 0.05,
      json: [{ name: 'TestBrand', strategy: 'invented', reasoning: 'Great' }],
    })
    // Branding (CFO)
    .mockResolvedValueOnce({ text: 'purchased', cost: 0.01, json: {} })
    // Planning
    .mockResolvedValueOnce({ text: 'plan', cost: 0.05, json: { phases: ['p1'] } })
    // Deployment
    .mockResolvedValueOnce({ text: 'deployed', cost: 0.02, json: deployJson });

  mockRunLoop.mockResolvedValue({ text: 'dev', json: null, cost: 1, iterations: 2, completed: true });
}

describe('Domain Attachment in Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbOps.length = 0;
  });

  it('attaches domain when projectName and domainName are available', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: true, domain: { name: 'testbrand.xyz', verified: true } });
    mockGetDomainConfig.mockResolvedValue({ success: true, verified: true });

    const orch = new PipelineOrchestrator('run-attach');
    await orch.execute();

    expect(mockAddDomain).toHaveBeenCalledWith('test', 'testbrand.xyz', 'test-vercel-token');
    expect(mockGetDomainConfig).toHaveBeenCalledWith('test', 'testbrand.xyz', 'test-vercel-token');

    // Check that domain attachment log was written
    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    const attachLog = logInserts.find((op) => op.data.content.includes('Attaching domain'));
    expect(attachLog).toBeDefined();
  });

  it('logs verified status when DNS is verified', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: true, domain: { name: 'testbrand.xyz', verified: true } });
    mockGetDomainConfig.mockResolvedValue({ success: true, verified: true });

    const orch = new PipelineOrchestrator('run-verified');
    await orch.execute();

    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    const verifiedLog = logInserts.find((op) => op.data.content.includes('attached and verified'));
    expect(verifiedLog).toBeDefined();
  });

  it('logs pending verification when DNS is not yet verified', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: true, domain: { name: 'testbrand.xyz', verified: false } });
    mockGetDomainConfig.mockResolvedValue({ success: true, verified: false });

    const orch = new PipelineOrchestrator('run-pending');
    await orch.execute();

    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    const pendingLog = logInserts.find((op) => op.data.content.includes('DNS verification pending'));
    expect(pendingLog).toBeDefined();
  });

  it('treats 409 (already exists) as successful attachment', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: true, alreadyExists: true });
    mockGetDomainConfig.mockResolvedValue({ success: true, verified: true });

    const orch = new PipelineOrchestrator('run-409');
    await orch.execute();

    // Should still check domain config after "already exists"
    expect(mockGetDomainConfig).toHaveBeenCalled();
  });

  it('falls back to parsed projectName from deployUrl when agent omits it', async () => {
    // No projectName, but deployUrl is a Vercel URL → fallback parses it
    setupFullPipelineMocks({ deployUrl: 'https://my-app-abc12345.vercel.app', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: true, domain: { name: 'testbrand.xyz', verified: true } });
    mockGetDomainConfig.mockResolvedValue({ success: true, verified: true });

    const orch = new PipelineOrchestrator('run-fallback');
    await orch.execute();

    // Should use parsed name "my-app" as the project identifier
    expect(mockAddDomain).toHaveBeenCalledWith('my-app', 'testbrand.xyz', 'test-vercel-token');

    // Should log the fallback
    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    const fallbackLog = logInserts.find((op) => op.data.content.includes('falling back to parsed name'));
    expect(fallbackLog).toBeDefined();
  });

  it('skips attachment when no projectName and non-Vercel deploy URL', async () => {
    // deployUrl is not a Vercel URL and no projectName → can't determine project
    setupFullPipelineMocks({ deployUrl: 'https://custom-host.example.com', provider: 'vercel', status: 'deployed' });

    const orch = new PipelineOrchestrator('run-no-project');
    await orch.execute();

    expect(mockAddDomain).not.toHaveBeenCalled();

    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    const skipLog = logInserts.find((op) => op.data.content.includes('could not determine Vercel project name'));
    expect(skipLog).toBeDefined();
  });

  it('handles Vercel API error gracefully without failing pipeline', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: false, error: 'Rate limited' });

    const orch = new PipelineOrchestrator('run-api-err');
    await orch.execute();

    // Pipeline should still complete (domain attachment failure is non-fatal)
    const runUpdates = dbOps.filter((op) => op.table === 'runs' && op.op === 'update');
    const completed = runUpdates.find((op) => op.data.status === 'completed');
    expect(completed).toBeDefined();

    // Error should be logged
    const logInserts = dbOps.filter((op) => op.table === 'logs' && op.op === 'insert');
    const errorLog = logInserts.find((op) => op.data.content.includes('Failed to add domain'));
    expect(errorLog).toBeDefined();
  });

  it('handles thrown exception from Vercel API without failing pipeline', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockRejectedValue(new Error('Network timeout'));

    const orch = new PipelineOrchestrator('run-throw');
    await orch.execute();

    // Pipeline should still complete
    const runUpdates = dbOps.filter((op) => op.table === 'runs' && op.op === 'update');
    const completed = runUpdates.find((op) => op.data.status === 'completed');
    expect(completed).toBeDefined();
  });

  it('still registers product with domain_name even if attachment fails', async () => {
    setupFullPipelineMocks({ deployUrl: 'https://test.vercel.app', projectName: 'test', provider: 'vercel', status: 'deployed' });
    mockAddDomain.mockResolvedValue({ success: false, error: 'Something broke' });

    const orch = new PipelineOrchestrator('run-product');
    await orch.execute();

    const productInsert = dbOps.find((op) => op.table === 'products' && op.op === 'insert');
    expect(productInsert).toBeDefined();
    expect(productInsert!.data.domain_name).toBe('testbrand.xyz');
    expect(productInsert!.data.deploy_url).toBe('https://test.vercel.app');
  });
});
