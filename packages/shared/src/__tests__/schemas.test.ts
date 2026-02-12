import { describe, it, expect } from 'vitest';
import {
  ideationConfigSchema,
  brandingConfigSchema,
  planningConfigSchema,
  developmentConfigSchema,
  deploymentConfigSchema,
  departmentSchema,
  agentSchema,
  agentCharacteristicsSchema,
  stageStatusSchema,
  hitlConfigSchema,
  updateHitlConfigSchema,
  hitlGateActionSchema,
  rejectStageSchema,
  domainChoiceSchema,
  approveStageSchema,
} from '../schemas.js';
import { STAGES, RUN_STATUSES, STAGE_STATUSES, AGENT_SLUGS, STAGE_AGENT_MAP } from '../constants.js';

describe('ideationConfigSchema', () => {
  it('validates a correct ideation config', () => {
    const config = {
      platform: 'web',
      audience: 'consumer',
      complexity: 'simple',
      custom_rules: ['Only utility apps'],
    };
    expect(ideationConfigSchema.parse(config)).toEqual(config);
  });

  it('accepts empty config (all optional)', () => {
    expect(ideationConfigSchema.parse({})).toEqual({});
  });

  it('rejects invalid platform value', () => {
    expect(() =>
      ideationConfigSchema.parse({ platform: 'mobile' })
    ).toThrow();
  });

  it('rejects invalid audience value', () => {
    expect(() =>
      ideationConfigSchema.parse({ audience: 'enterprise' })
    ).toThrow();
  });
});

describe('planningConfigSchema', () => {
  it('validates a correct planning config', () => {
    const config = {
      max_phases: 5,
      require_tests: true,
      max_files_per_phase: 10,
      custom_rules: ['Keep phases small'],
    };
    expect(planningConfigSchema.parse(config)).toEqual(config);
  });

  it('rejects max_phases below 1', () => {
    expect(() =>
      planningConfigSchema.parse({ max_phases: 0 })
    ).toThrow();
  });
});

describe('developmentConfigSchema', () => {
  it('validates a correct development config', () => {
    const config = {
      framework: 'react',
      language: 'typescript',
      max_files: 20,
      max_iterations: 20,
      max_budget_usd: 10,
      custom_rules: ['Use Vite'],
    };
    expect(developmentConfigSchema.parse(config)).toEqual(config);
  });

  it('rejects max_budget_usd below 0.1', () => {
    expect(() =>
      developmentConfigSchema.parse({ max_budget_usd: 0 })
    ).toThrow();
  });
});

describe('brandingConfigSchema', () => {
  it('validates a correct branding config', () => {
    const config = {
      max_domain_price: 15,
      preferred_tlds: ['xyz', 'io'],
      custom_rules: ['Short names only'],
    };
    expect(brandingConfigSchema.parse(config)).toEqual(config);
  });

  it('accepts empty config (all optional)', () => {
    expect(brandingConfigSchema.parse({})).toEqual({});
  });

  it('rejects max_domain_price below 1', () => {
    expect(() =>
      brandingConfigSchema.parse({ max_domain_price: 0 })
    ).toThrow();
  });

  it('rejects max_domain_price above 200', () => {
    expect(() =>
      brandingConfigSchema.parse({ max_domain_price: 300 })
    ).toThrow();
  });
});

describe('deploymentConfigSchema', () => {
  it('validates a correct deployment config', () => {
    const config = {
      provider: 'vercel',
      auto_deploy: true,
      custom_rules: ['Use production flag'],
    };
    expect(deploymentConfigSchema.parse(config)).toEqual(config);
  });

  it('rejects invalid provider', () => {
    expect(() =>
      deploymentConfigSchema.parse({ provider: 'netlify' })
    ).toThrow();
  });
});

describe('departmentSchema', () => {
  it('validates all department names including branding', () => {
    for (const dept of ['ideation', 'branding', 'planning', 'development', 'deployment']) {
      expect(departmentSchema.parse(dept)).toBe(dept);
    }
  });

  it('rejects invalid department', () => {
    expect(() => departmentSchema.parse('marketing')).toThrow();
  });
});

describe('constants', () => {
  it('STAGES has exactly 5 entries in correct order', () => {
    expect(STAGES).toEqual(['ideation', 'branding', 'planning', 'development', 'deployment']);
    expect(STAGES).toHaveLength(5);
  });

  it('RUN_STATUSES has all expected values', () => {
    expect(RUN_STATUSES).toContain('queued');
    expect(RUN_STATUSES).toContain('running');
    expect(RUN_STATUSES).toContain('completed');
    expect(RUN_STATUSES).toContain('failed');
    expect(RUN_STATUSES).toContain('cancelled');
  });

  it('STAGE_STATUSES has all expected values including awaiting_approval and cancelled', () => {
    expect(STAGE_STATUSES).toContain('pending');
    expect(STAGE_STATUSES).toContain('running');
    expect(STAGE_STATUSES).toContain('completed');
    expect(STAGE_STATUSES).toContain('failed');
    expect(STAGE_STATUSES).toContain('cancelled');
    expect(STAGE_STATUSES).toContain('skipped');
    expect(STAGE_STATUSES).toContain('awaiting_approval');
  });
});

describe('stageStatusSchema', () => {
  it('validates all stage statuses including cancelled and awaiting_approval', () => {
    for (const status of ['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped', 'awaiting_approval']) {
      expect(stageStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects invalid stage status', () => {
    expect(() => stageStatusSchema.parse('paused')).toThrow();
  });
});

describe('hitlConfigSchema', () => {
  it('validates a complete HITL config including gate_after_branding', () => {
    const config = {
      enabled: true,
      gate_after_ideation: true,
      gate_after_branding: true,
      gate_after_planning: false,
      gate_after_development: true,
    };
    expect(hitlConfigSchema.parse(config)).toEqual(config);
  });

  it('rejects config with missing required fields', () => {
    expect(() => hitlConfigSchema.parse({ enabled: true })).toThrow();
  });

  it('rejects config missing gate_after_branding', () => {
    expect(() =>
      hitlConfigSchema.parse({
        enabled: true,
        gate_after_ideation: true,
        gate_after_planning: true,
        gate_after_development: true,
      })
    ).toThrow();
  });

  it('rejects non-boolean values', () => {
    expect(() =>
      hitlConfigSchema.parse({
        enabled: 'yes',
        gate_after_ideation: true,
        gate_after_branding: true,
        gate_after_planning: true,
        gate_after_development: true,
      })
    ).toThrow();
  });
});

describe('updateHitlConfigSchema', () => {
  it('accepts partial updates', () => {
    expect(updateHitlConfigSchema.parse({ enabled: true })).toEqual({ enabled: true });
  });

  it('accepts partial update with gate_after_branding', () => {
    expect(updateHitlConfigSchema.parse({ gate_after_branding: false })).toEqual({ gate_after_branding: false });
  });

  it('accepts empty object (no changes)', () => {
    expect(updateHitlConfigSchema.parse({})).toEqual({});
  });
});

describe('hitlGateActionSchema', () => {
  it('validates all gate actions', () => {
    for (const action of ['approve', 'retry', 'cancel']) {
      expect(hitlGateActionSchema.parse(action)).toBe(action);
    }
  });

  it('rejects invalid action', () => {
    expect(() => hitlGateActionSchema.parse('skip')).toThrow();
  });
});

describe('rejectStageSchema', () => {
  it('validates retry action', () => {
    expect(rejectStageSchema.parse({ action: 'retry' })).toEqual({ action: 'retry' });
  });

  it('validates cancel action', () => {
    expect(rejectStageSchema.parse({ action: 'cancel' })).toEqual({ action: 'cancel' });
  });

  it('rejects approve as a reject action', () => {
    expect(() => rejectStageSchema.parse({ action: 'approve' })).toThrow();
  });

  it('AGENT_SLUGS has all 6 agent slugs', () => {
    expect(AGENT_SLUGS.IDEATOR).toBe('ideator');
    expect(AGENT_SLUGS.BRANDER).toBe('brander');
    expect(AGENT_SLUGS.CFO).toBe('cfo');
    expect(AGENT_SLUGS.PLANNER).toBe('planner');
    expect(AGENT_SLUGS.DEVELOPER).toBe('developer');
    expect(AGENT_SLUGS.DEPLOYER).toBe('deployer');
  });

  it('STAGE_AGENT_MAP maps all stages to agent slugs', () => {
    expect(STAGE_AGENT_MAP.ideation).toBe('ideator');
    expect(STAGE_AGENT_MAP.branding).toBe('brander');
    expect(STAGE_AGENT_MAP.planning).toBe('planner');
    expect(STAGE_AGENT_MAP.development).toBe('developer');
    expect(STAGE_AGENT_MAP.deployment).toBe('deployer');
  });
});

describe('domainChoiceSchema', () => {
  const validChoice = {
    domain: 'coolapp.xyz',
    name: 'CoolApp',
    price: 2,
    tld: 'xyz',
    strategy: 'invented',
    reasoning: 'Short and memorable',
    score: 85,
  };

  it('validates a correct domain choice', () => {
    expect(domainChoiceSchema.parse(validChoice)).toEqual(validChoice);
  });

  it('rejects empty domain', () => {
    expect(() => domainChoiceSchema.parse({ ...validChoice, domain: '' })).toThrow();
  });

  it('rejects missing fields', () => {
    expect(() => domainChoiceSchema.parse({ domain: 'test.xyz' })).toThrow();
  });

  it('rejects negative price', () => {
    expect(() => domainChoiceSchema.parse({ ...validChoice, price: -1 })).toThrow();
  });
});

describe('approveStageSchema', () => {
  it('accepts empty body (no domain choice)', () => {
    expect(approveStageSchema.parse({})).toEqual({});
  });

  it('accepts body with chosen_domain', () => {
    const body = {
      chosen_domain: {
        domain: 'coolapp.xyz',
        name: 'CoolApp',
        price: 2,
        tld: 'xyz',
        strategy: 'invented',
        reasoning: 'Great name',
        score: 85,
      },
    };
    expect(approveStageSchema.parse(body)).toEqual(body);
  });

  it('rejects invalid chosen_domain', () => {
    expect(() => approveStageSchema.parse({ chosen_domain: { domain: '' } })).toThrow();
  });
});

describe('agentCharacteristicsSchema', () => {
  it('validates characteristics with all fields', () => {
    const chars = { tone: 'creative', emoji: '💡', color: '#4ade80' };
    expect(agentCharacteristicsSchema.parse(chars)).toEqual(chars);
  });

  it('accepts empty characteristics', () => {
    expect(agentCharacteristicsSchema.parse({})).toEqual({});
  });

  it('passes through unknown fields', () => {
    const chars = { tone: 'creative', customField: 'value' };
    expect(agentCharacteristicsSchema.parse(chars)).toEqual(chars);
  });
});

describe('agentSchema', () => {
  const validAgent = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'ideator',
    name: 'Nova',
    stage: 'ideation' as const,
    role_description: 'Product Ideation Specialist',
    avatar_url: null,
    characteristics: { tone: 'creative', emoji: '💡', color: '#4ade80' },
    is_active: true,
    display_order: 0,
    created_at: '2026-02-11T00:00:00.000Z',
  };

  it('validates a correct agent', () => {
    expect(agentSchema.parse(validAgent)).toEqual(validAgent);
  });

  it('validates agent with avatar_url', () => {
    const agent = { ...validAgent, avatar_url: 'https://example.com/avatar.png' };
    expect(agentSchema.parse(agent)).toEqual(agent);
  });

  it('rejects agent with missing required fields', () => {
    expect(() => agentSchema.parse({ id: validAgent.id })).toThrow();
    expect(() => agentSchema.parse({ ...validAgent, slug: '' })).toThrow();
    expect(() => agentSchema.parse({ ...validAgent, name: '' })).toThrow();
  });

  it('rejects agent with invalid stage', () => {
    expect(() => agentSchema.parse({ ...validAgent, stage: 'marketing' })).toThrow();
  });

  it('rejects agent with invalid uuid', () => {
    expect(() => agentSchema.parse({ ...validAgent, id: 'not-a-uuid' })).toThrow();
  });
});
