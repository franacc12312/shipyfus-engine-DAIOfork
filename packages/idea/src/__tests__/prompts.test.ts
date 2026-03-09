import { describe, expect, it } from 'vitest';
import { buildIdeatorPrompt } from '../index.js';

describe('buildIdeatorPrompt', () => {
  it('includes research and custom rules when present', () => {
    const prompt = buildIdeatorPrompt(
      {
        platform: 'web',
        audience: 'consumer',
        complexity: 'simple',
        custom_rules: ['Prioritize collaboration', 'Avoid paid APIs'],
      },
      '# Signals\n- Users want faster async reviews',
    );

    expect(prompt).toContain('Market Research');
    expect(prompt).toContain('Prioritize collaboration');
    expect(prompt).toContain('Avoid paid APIs');
    expect(prompt).toContain('Users want faster async reviews');
  });
});
