import { describe, expect, it, vi } from 'vitest';
import { NoopApprovalService } from '@daio/approval';
import type { StageContext } from '@daio/pipeline-core';
import { createPlanningStage } from '../index.js';

function createContext(json: unknown): StageContext {
  return {
    runId: 'run-1',
    stage: 'planning',
    productDir: '/tmp/run-1',
    runner: {
      runOnce: vi.fn().mockResolvedValue({
        text: 'ok',
        json,
        cost: 0.5,
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

describe('createPlanningStage', () => {
  it('returns plan metadata when the agent output is an object', async () => {
    const stage = createPlanningStage();
    const ctx = createContext({
      planFilePath: 'thoughts/PLAN.md',
      progressFilePath: 'thoughts/PROGRESS.md',
      phases: ['Phase 1'],
      totalTasks: 5,
    });

    const result = await stage.run(ctx, {
      prd: {
        productName: 'FocusForge',
        productDescription: 'A focused work sprint planner for solo founders.',
        targetUser: 'solo founders',
        problemStatement: 'Staying on one meaningful task is hard.',
        coreFunctionality: ['plan sprint', 'track progress', 'review outcomes'],
        technicalRequirements: 'React and local storage',
        suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: ['vite'] },
        mvpScope: 'Single-user sprint workflow',
        successCriteria: ['Users complete a sprint', 'Users review outcomes'],
        uniqueValue: 'Turns messy priorities into one deliberate sprint',
      },
      config: { max_phases: 5, require_tests: true, max_files_per_phase: 10 },
    });

    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;

    expect(result.output.plan.planFilePath).toBe('thoughts/PLAN.md');
    expect(result.output.costUsd).toBe(0.5);
  });

  it('fails cleanly when the agent output is not an object', async () => {
    const stage = createPlanningStage();
    const ctx = createContext('bad-payload');
    const result = await stage.run(ctx, {
      prd: {
        productName: 'FocusForge',
        productDescription: 'A focused work sprint planner for solo founders.',
        targetUser: 'solo founders',
        problemStatement: 'Staying on one meaningful task is hard.',
        coreFunctionality: ['plan sprint', 'track progress', 'review outcomes'],
        technicalRequirements: 'React and local storage',
        suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: ['vite'] },
        mvpScope: 'Single-user sprint workflow',
        successCriteria: ['Users complete a sprint', 'Users review outcomes'],
        uniqueValue: 'Turns messy priorities into one deliberate sprint',
      },
      config: { max_phases: 5, require_tests: true, max_files_per_phase: 10 },
    });

    expect(result).toEqual({
      status: 'failed',
      error: 'Planning failed to produce plan metadata',
      recoverable: true,
    });
  });
});
