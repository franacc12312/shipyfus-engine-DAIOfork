import { describe, it, expect } from 'vitest';
import { buildIdeatorPrompt } from '../agents/prompts/ideator.js';
import { buildPlannerPrompt } from '../agents/prompts/planner.js';
import { buildDeveloperPrompt } from '../agents/prompts/developer.js';
import { buildDeployerPrompt } from '../agents/prompts/deployer.js';
import { buildBranderPrompt, buildCFOPrompt } from '../agents/prompts/brander.js';
import type { IdeationConfig, BrandingConfig, PlanningConfig, DevelopmentConfig, DeploymentConfig, ProductPRD } from '@daio/shared';

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

  it('includes projectName in output format', () => {
    const config: DeploymentConfig = { provider: 'vercel', auto_deploy: true };
    const prompt = buildDeployerPrompt(config, 'tok');
    expect(prompt).toContain('projectName');
  });

  it('does not contain domain CLI commands (handled programmatically)', () => {
    const config: DeploymentConfig = { provider: 'vercel', auto_deploy: true };
    const prompt = buildDeployerPrompt(config, 'tok');
    expect(prompt).not.toContain('vercel domains add');
    expect(prompt).not.toContain('Custom Domain');
    expect(prompt).not.toContain('customDomain');
  });

  it('only accepts config and token parameters', () => {
    const config: DeploymentConfig = { provider: 'vercel', auto_deploy: true };
    // buildDeployerPrompt now takes exactly 2 params (no domainName)
    expect(buildDeployerPrompt.length).toBe(2);
  });
});

describe('buildBranderPrompt', () => {
  it('includes PRD details and branding config', () => {
    const config: BrandingConfig = { max_domain_price: 10, preferred_tlds: ['xyz', 'com'] };
    const prompt = buildBranderPrompt(mockPRD, config);
    expect(prompt).toContain('A test application');
    expect(prompt).toContain('developers');
    expect(prompt).toContain('xyz, com');
    expect(prompt).toContain('$10');
  });

  it('mentions .xyz priority', () => {
    const config: BrandingConfig = {};
    const prompt = buildBranderPrompt(mockPRD, config);
    expect(prompt).toContain('xyz');
    expect(prompt).toContain('$2');
  });

  it('uses workingTitle when available', () => {
    const prdWithTitle = { ...mockPRD, workingTitle: 'WorkInProgress' };
    const config: BrandingConfig = {};
    const prompt = buildBranderPrompt(prdWithTitle, config);
    expect(prompt).toContain('WorkInProgress');
  });

  it('includes naming strategy instructions', () => {
    const config: BrandingConfig = {};
    const prompt = buildBranderPrompt(mockPRD, config);
    expect(prompt).toContain('invented');
    expect(prompt).toContain('compound');
    expect(prompt).toContain('domain-hack');
  });
});

describe('buildCFOPrompt', () => {
  it('includes domain and price', () => {
    const prompt = buildCFOPrompt('cool.xyz', 2.04, 'CoolApp');
    expect(prompt).toContain('cool.xyz');
    expect(prompt).toContain('2.04');
    expect(prompt).toContain('CoolApp');
    expect(prompt).toContain('Porkbun');
  });

  it('returns non-empty string', () => {
    expect(buildCFOPrompt('test.xyz', 2, 'Test').length).toBeGreaterThan(0);
  });
});

describe('buildIdeatorPrompt (updated)', () => {
  it('references workingTitle in output format', () => {
    const config: IdeationConfig = { platform: 'web', audience: 'consumer', complexity: 'simple' };
    const prompt = buildIdeatorPrompt(config);
    expect(prompt).toContain('workingTitle');
    expect(prompt).toContain('brand specialist');
  });
});
