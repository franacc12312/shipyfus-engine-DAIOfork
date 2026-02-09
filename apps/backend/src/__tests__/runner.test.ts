import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentRunner } from '../agents/runner.js';

// Mock db to prevent actual Supabase calls
vi.mock('../services/db.js', () => ({
  db: {
    from: () => ({
      insert: () => ({ error: null }),
      update: () => ({
        eq: () => ({
          eq: () => ({ error: null }),
          error: null,
        }),
        error: null,
      }),
    }),
  },
}));

describe('AgentRunner', () => {
  let runner: AgentRunner;

  beforeEach(() => {
    runner = new AgentRunner();
  });

  afterEach(async () => {
    await runner.destroy();
  });

  describe('extractJsonFromText', () => {
    it('extracts JSON from code fence', () => {
      const text = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
      const result = runner.extractJsonFromText(text);
      expect(result).toEqual({ key: 'value' });
    });

    it('extracts the last JSON block when multiple exist', () => {
      const text = '```json\n{"first": true}\n```\nMiddle\n```json\n{"second": true}\n```';
      const result = runner.extractJsonFromText(text);
      expect(result).toEqual({ second: true });
    });

    it('returns null when no JSON fence found', () => {
      expect(runner.extractJsonFromText('no json here')).toBeNull();
    });

    it('returns null for malformed JSON in fence', () => {
      expect(runner.extractJsonFromText('```json\n{bad json}\n```')).toBeNull();
    });

    it('handles complex nested JSON', () => {
      const json = { name: 'Test', features: ['a', 'b'], config: { nested: true } };
      const text = `\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\``;
      expect(runner.extractJsonFromText(text)).toEqual(json);
    });
  });

  describe('containsCompletionPromise', () => {
    it('detects completion promise', () => {
      const text = 'Work done. <promise>PRODUCT COMPLETE</promise>';
      expect(runner.containsCompletionPromise(text, 'PRODUCT COMPLETE')).toBe(true);
    });

    it('returns false when promise not present', () => {
      expect(runner.containsCompletionPromise('no promise here', 'PRODUCT COMPLETE')).toBe(false);
    });

    it('returns false for partial match', () => {
      expect(runner.containsCompletionPromise('<promise>PRODUCT', 'PRODUCT COMPLETE')).toBe(false);
    });

    it('handles multiline text', () => {
      const text = 'Line 1\nLine 2\n<promise>PRODUCT COMPLETE</promise>\nLine 4';
      expect(runner.containsCompletionPromise(text, 'PRODUCT COMPLETE')).toBe(true);
    });
  });

  describe('kill', () => {
    it('returns false when no active process for stage', () => {
      expect(runner.kill('nonexistent')).toBe(false);
    });
  });
});
