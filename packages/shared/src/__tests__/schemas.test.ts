import { describe, it, expect } from 'vitest';
import {
  ideationConfigSchema,
  planningConfigSchema,
  developmentConfigSchema,
  deploymentConfigSchema,
  departmentSchema,
  stageStatusSchema,
  hitlConfigSchema,
  updateHitlConfigSchema,
  hitlGateActionSchema,
  rejectStageSchema,
} from '../schemas.js';
import { STAGES, RUN_STATUSES, STAGE_STATUSES } from '../constants.js';

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
  it('validates all department names', () => {
    for (const dept of ['ideation', 'planning', 'development', 'deployment']) {
      expect(departmentSchema.parse(dept)).toBe(dept);
    }
  });

  it('rejects invalid department', () => {
    expect(() => departmentSchema.parse('marketing')).toThrow();
  });
});

describe('constants', () => {
  it('STAGES has exactly 4 entries in correct order', () => {
    expect(STAGES).toEqual(['ideation', 'planning', 'development', 'deployment']);
    expect(STAGES).toHaveLength(4);
  });

  it('RUN_STATUSES has all expected values', () => {
    expect(RUN_STATUSES).toContain('queued');
    expect(RUN_STATUSES).toContain('running');
    expect(RUN_STATUSES).toContain('completed');
    expect(RUN_STATUSES).toContain('failed');
    expect(RUN_STATUSES).toContain('cancelled');
  });

  it('STAGE_STATUSES has all expected values including awaiting_approval', () => {
    expect(STAGE_STATUSES).toContain('pending');
    expect(STAGE_STATUSES).toContain('running');
    expect(STAGE_STATUSES).toContain('completed');
    expect(STAGE_STATUSES).toContain('failed');
    expect(STAGE_STATUSES).toContain('skipped');
    expect(STAGE_STATUSES).toContain('awaiting_approval');
  });
});

describe('stageStatusSchema', () => {
  it('validates all stage statuses including awaiting_approval', () => {
    for (const status of ['pending', 'running', 'completed', 'failed', 'skipped', 'awaiting_approval']) {
      expect(stageStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects invalid stage status', () => {
    expect(() => stageStatusSchema.parse('paused')).toThrow();
  });
});

describe('hitlConfigSchema', () => {
  it('validates a complete HITL config', () => {
    const config = {
      enabled: true,
      gate_after_ideation: true,
      gate_after_planning: false,
      gate_after_development: true,
    };
    expect(hitlConfigSchema.parse(config)).toEqual(config);
  });

  it('rejects config with missing required fields', () => {
    expect(() => hitlConfigSchema.parse({ enabled: true })).toThrow();
  });

  it('rejects non-boolean values', () => {
    expect(() =>
      hitlConfigSchema.parse({
        enabled: 'yes',
        gate_after_ideation: true,
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
});
