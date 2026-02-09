import { describe, it, expect } from 'vitest';
import { buildIdeatorPrompt } from '../agents/prompts/ideator.js';
import { buildPlannerPrompt } from '../agents/prompts/planner.js';
import { buildDeveloperPrompt } from '../agents/prompts/developer.js';
import { buildDeployerPrompt } from '../agents/prompts/deployer.js';
import type { IdeationConfig, PlanningConfig, DevelopmentConfig, DeploymentConfig, ProductPRD } from '@daio/shared';

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

describe('buildIdeatorPrompt', () => {
  it('includes platform, audience, complexity', () => {
    const config: IdeationConfig = { platform: 'web', audience: 'consumer', complexity: 'simple' };
    const prompt = buildIdeatorPrompt(config);
    expect(prompt).toContain('web');
    expect(prompt).toContain('consumer');
    expect(prompt).toContain('simple');
  });

  it('includes custom rules when provided', () => {
    const config: IdeationConfig = {
      platform: 'cli',
      audience: 'developer',
      complexity: 'moderate',
      custom_rules: ['Rule A', 'Rule B'],
    };
    const prompt = buildIdeatorPrompt(config);
    expect(prompt).toContain('Rule A');
    expect(prompt).toContain('Rule B');
  });

  it('handles missing custom rules', () => {
    const config: IdeationConfig = { platform: 'web', audience: 'consumer', complexity: 'simple' };
    const prompt = buildIdeatorPrompt(config);
    expect(prompt).not.toContain('Custom rules');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('returns non-empty string', () => {
    const config: IdeationConfig = { platform: 'web', audience: 'consumer', complexity: 'simple' };
    expect(buildIdeatorPrompt(config).length).toBeGreaterThan(0);
  });
});

describe('buildPlannerPrompt', () => {
  it('includes PRD data', () => {
    const config: PlanningConfig = { max_phases: 5, require_tests: true, max_files_per_phase: 10 };
    const prompt = buildPlannerPrompt(mockPRD, config);
    expect(prompt).toContain('TestApp');
    expect(prompt).toContain('A test application');
  });

  it('includes planning constraints', () => {
    const config: PlanningConfig = { max_phases: 3, require_tests: true, max_files_per_phase: 5 };
    const prompt = buildPlannerPrompt(mockPRD, config);
    expect(prompt).toContain('3');
    expect(prompt).toContain('true');
  });

  it('includes completion promise instruction', () => {
    const config: PlanningConfig = { max_phases: 5, require_tests: true, max_files_per_phase: 10 };
    const prompt = buildPlannerPrompt(mockPRD, config);
    expect(prompt).toContain('PRODUCT COMPLETE');
  });
});

describe('buildDeveloperPrompt', () => {
  it('is a simple static prompt with constraints', () => {
    const config: DevelopmentConfig = { language: 'typescript', framework: 'react', max_files: 20 };
    const prompt = buildDeveloperPrompt(config);
    expect(prompt).toContain('thoughts/PLAN.md');
    expect(prompt).toContain('PRODUCT COMPLETE');
  });

  it('includes development constraints', () => {
    const config: DevelopmentConfig = { language: 'python', framework: 'flask', max_files: 15 };
    const prompt = buildDeveloperPrompt(config);
    expect(prompt).toContain('python');
    expect(prompt).toContain('flask');
    expect(prompt).toContain('15');
  });

  it('returns non-empty string', () => {
    const config: DevelopmentConfig = { language: 'typescript', framework: 'react', max_files: 20 };
    expect(buildDeveloperPrompt(config).length).toBeGreaterThan(0);
  });
});

describe('buildDeployerPrompt', () => {
  it('includes VERCEL_TOKEN instruction', () => {
    const config: DeploymentConfig = { provider: 'vercel', auto_deploy: true };
    const prompt = buildDeployerPrompt(config, 'my-token-123');
    expect(prompt).toContain('my-token-123');
    expect(prompt).toContain('vercel');
  });

  it('returns non-empty string', () => {
    const config: DeploymentConfig = { provider: 'vercel', auto_deploy: true };
    expect(buildDeployerPrompt(config, 'tok').length).toBeGreaterThan(0);
  });
});
