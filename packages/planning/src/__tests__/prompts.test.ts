import { describe, expect, it } from 'vitest';
import type { AnalyticsConfig, PlanningConfig, ProductPRD } from '@daio/shared';
import { buildPlannerPrompt } from '../index.js';

const mockPRD: ProductPRD = {
  productName: 'TestApp',
  productDescription: 'A test application',
  targetUser: 'developers',
  problemStatement: 'Testing needs',
  coreFunctionality: ['feature1', 'feature2'],
  technicalRequirements: 'TypeScript',
  suggestedTechStack: { framework: 'React', language: 'TypeScript', keyDependencies: ['vite'] },
  mvpScope: 'Basic version',
  successCriteria: ['works', 'tests pass'],
  uniqueValue: 'unique',
};

describe('buildPlannerPrompt', () => {
  it('includes PRD data and planning constraints', () => {
    const config: PlanningConfig = { max_phases: 3, require_tests: true, max_files_per_phase: 5 };
    const prompt = buildPlannerPrompt(mockPRD, config);

    expect(prompt).toContain('TestApp');
    expect(prompt).toContain('A test application');
    expect(prompt).toContain('3');
    expect(prompt).toContain('PRODUCT COMPLETE');
  });

  it('includes analytics instructions when enabled', () => {
    const config: PlanningConfig = { max_phases: 5, require_tests: true, max_files_per_phase: 10 };
    const analytics: AnalyticsConfig = { enabled: true, provider: 'posthog' };
    const prompt = buildPlannerPrompt(mockPRD, config, analytics);

    expect(prompt).toContain('PostHog');
    expect(prompt).toContain('posthog-js');
    expect(prompt).toContain('posthog.capture');
  });
});
