import { describe, expect, it, vi } from 'vitest';
import { NoopApprovalService } from '@daio/approval';
import type { StageContext } from '@daio/pipeline-core';
import { createIdeationStage } from '../index.js';

function createContext(json: unknown): StageContext {
  return {
    runId: 'run-1',
    stage: 'ideation',
    productDir: '/tmp/run-1',
    runner: {
      runOnce: vi.fn().mockResolvedValue({
        text: 'ok',
        json,
        cost: 0.25,
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

describe('createIdeationStage', () => {
  it('returns a scored PRD when the agent output is valid', async () => {
    const stage = createIdeationStage();
    const ctx = createContext({
      productName: 'FocusForge',
      workingTitle: 'FocusForge',
      productDescription: 'A focused work sprint planner for solo founders.',
      targetUser: 'solo founders',
      problemStatement: 'Staying on one meaningful task is hard.',
      coreFunctionality: ['plan sprint', 'track progress', 'review outcomes'],
      technicalRequirements: 'React and local storage',
      suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: ['vite'] },
      mvpScope: 'Single-user sprint workflow',
      successCriteria: ['Users complete a sprint', 'Users review outcomes'],
      uniqueValue: 'Turns messy priorities into one deliberate sprint',
    });

    const result = await stage.run(ctx, {
      config: { platform: 'web', audience: 'business', complexity: 'simple' },
    });

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;

    expect(result.output.prd.productName).toBe('FocusForge');
    expect(result.output.candidates[0].scorecard.total).toBeGreaterThan(0);
  });

  it('fails cleanly when the agent output is invalid', async () => {
    const stage = createIdeationStage();
    const ctx = createContext({ bad: 'payload' });
    const result = await stage.run(ctx, {
      config: { platform: 'web', audience: 'business', complexity: 'simple' },
    });

    expect(result).toEqual({
      status: 'failed',
      error: 'Ideation failed to produce a valid PRD',
      recoverable: true,
    });
  });
});
