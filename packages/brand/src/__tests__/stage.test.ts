import { describe, expect, it, vi } from 'vitest';
import { NoopApprovalService } from '@daio/approval';
import type { StageContext } from '@daio/pipeline-core';
import { createBrandingStage } from '../index.js';

vi.mock('../scoring.js', () => ({
  rankCandidates: vi.fn(),
}));

import { rankCandidates } from '../scoring.js';

const mockedRankCandidates = vi.mocked(rankCandidates);

const basePrd = {
  productName: 'SprintBoard',
  workingTitle: 'SprintBoard',
  productDescription: 'A product planning cockpit for solo founders.',
  targetUser: 'solo founders',
  problemStatement: 'Shipping consistently is hard when priorities drift.',
  coreFunctionality: ['plan work', 'track progress', 'review shipped work'],
  technicalRequirements: 'TypeScript',
  suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: ['vite'] },
  mvpScope: 'single-user product planning',
  successCriteria: ['users create a plan', 'users complete a cycle'],
  uniqueValue: 'Tight product loop for one-person teams',
};

function createContext(json: unknown): StageContext {
  return {
    runId: 'run-branding',
    stage: 'branding',
    productDir: '/tmp/run-branding',
    runner: {
      runOnce: vi.fn().mockResolvedValue({
        text: 'brand result',
        json,
        cost: 0.15,
      }),
    },
    logger: {
      info: vi.fn().mockResolvedValue(undefined),
      warn: vi.fn().mockResolvedValue(undefined),
      error: vi.fn().mockResolvedValue(undefined),
    },
    artifacts: {
      readText: vi.fn(),
      writeText: vi.fn(),
      exists: vi.fn(),
      resolve: vi.fn(),
    },
    approvals: new NoopApprovalService(),
    now: () => '2026-03-09T00:00:00.000Z',
  };
}

describe('createBrandingStage', () => {
  it('returns top candidates without purchasing when human selection is enabled', async () => {
    mockedRankCandidates.mockResolvedValueOnce([
      {
        rank: 1,
        name: 'Forge',
        domain: 'forge.xyz',
        tld: 'xyz',
        strategy: 'invented',
        price: 2,
        reasoning: 'Short and memorable',
        score: 88,
        alternatives: [],
      },
    ]);

    const stage = createBrandingStage();
    const ctx = createContext([
      { name: 'Forge', strategy: 'invented', reasoning: 'Short and memorable' },
    ]);

    const result = await stage.run(ctx, {
      prd: { ...basePrd },
      config: {},
      humanSelectionEnabled: true,
    });

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.output.domainName).toBeNull();
    expect(result.output.outputContext.candidates).toEqual([
      {
        domain: 'forge.xyz',
        name: 'Forge',
        price: 2,
        tld: 'xyz',
        strategy: 'invented',
        reasoning: 'Short and memorable',
        score: 88,
      },
    ]);
  });

  it('auto-selects the top candidate and returns a purchased domain', async () => {
    mockedRankCandidates.mockResolvedValueOnce([
      {
        rank: 1,
        name: 'Forge',
        domain: 'forge.xyz',
        tld: 'xyz',
        strategy: 'invented',
        price: 2,
        reasoning: 'Short and memorable',
        score: 88,
        alternatives: [],
      },
    ]);

    const stage = createBrandingStage();
    const ctx = createContext([
      { name: 'Forge', strategy: 'invented', reasoning: 'Short and memorable' },
    ]);
    const purchaseDomain = vi.fn().mockResolvedValue({
      verified: true,
      dnsConfigured: true,
    });

    const result = await stage.run(ctx, {
      prd: { ...basePrd },
      config: {},
      purchaseDomain,
    });

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.output.prd.productName).toBe('Forge');
    expect(result.output.domainName).toBe('forge.xyz');
    expect(purchaseDomain).toHaveBeenCalledWith({
      domain: 'forge.xyz',
      name: 'Forge',
      price: 2,
      tld: 'xyz',
      strategy: 'invented',
      reasoning: 'Short and memorable',
      score: 0,
    });
  });
});
