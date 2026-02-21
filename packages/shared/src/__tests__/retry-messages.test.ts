import { describe, expect, it } from 'vitest';
import { RETRY_MESSAGES, getRandomRetryMessage } from '../constants.js';

describe('RETRY_MESSAGES', () => {
  it('has at least 30 entries', () => {
    expect(RETRY_MESSAGES.length).toBeGreaterThanOrEqual(30);
  });

  it('contains only non-empty strings', () => {
    for (const msg of RETRY_MESSAGES) {
      expect(typeof msg).toBe('string');
      expect(msg.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate messages', () => {
    const unique = new Set(RETRY_MESSAGES);
    expect(unique.size).toBe(RETRY_MESSAGES.length);
  });
});

describe('getRandomRetryMessage', () => {
  it('returns a string from the pool', () => {
    const msg = getRandomRetryMessage();
    expect(RETRY_MESSAGES).toContain(msg);
  });

  it('returns varied results across multiple calls', () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(getRandomRetryMessage());
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
