import { describe, it, expect } from 'vitest';
import { parseStreamLine, extractTextFromEvent, getEventType, type ClaudeStreamEvent } from '../agents/parser.js';

describe('parseStreamLine', () => {
  it('parses a system init event', () => {
    const line = JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 'sess-123',
      tools: ['Read', 'Write', 'Bash'],
      model: 'claude-sonnet-4-5-20250929',
      cwd: '/tmp/project',
    });

    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('system');
    expect((event as any).subtype).toBe('init');
    expect((event as any).session_id).toBe('sess-123');
  });

  it('parses an assistant event with text blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg-123',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello world' }],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'end_turn',
      },
    });

    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('assistant');
  });

  it('parses a result event', () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      duration_ms: 5000,
      duration_api_ms: 4500,
      is_error: false,
      num_turns: 3,
      result: 'Task complete',
      session_id: 'sess-123',
      total_cost_usd: 0.15,
    });

    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('result');
    expect((event as any).total_cost_usd).toBe(0.15);
  });

  it('returns null for malformed JSON', () => {
    expect(parseStreamLine('not json')).toBeNull();
    expect(parseStreamLine('{bad:')).toBeNull();
    expect(parseStreamLine('')).toBeNull();
  });

  it('returns null for objects without type field', () => {
    expect(parseStreamLine(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });

  it('parses assistant event with tool_use blocks', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        id: 'msg-456',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read the file' },
          { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/tmp/test.ts' } },
        ],
        model: 'claude-sonnet-4-5-20250929',
        stop_reason: 'tool_use',
      },
    });

    const event = parseStreamLine(line);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('assistant');
  });
});

describe('extractTextFromEvent', () => {
  it('extracts text from assistant event', () => {
    const event: ClaudeStreamEvent = {
      type: 'assistant',
      message: {
        id: 'msg-1',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }, { type: 'text', text: ' World' }],
        model: 'test',
        stop_reason: null,
      },
    };
    expect(extractTextFromEvent(event)).toBe('Hello World');
  });

  it('extracts result text from result event', () => {
    const event: ClaudeStreamEvent = {
      type: 'result',
      subtype: 'success',
      duration_ms: 100,
      duration_api_ms: 90,
      is_error: false,
      num_turns: 1,
      result: 'Done',
      session_id: 'x',
      total_cost_usd: 0.01,
    };
    expect(extractTextFromEvent(event)).toBe('Done');
  });

  it('returns empty string for system events', () => {
    const event: ClaudeStreamEvent = {
      type: 'system',
      subtype: 'init',
      session_id: 'x',
      tools: [],
      model: 'test',
      cwd: '/tmp',
    };
    expect(extractTextFromEvent(event)).toBe('');
  });
});

describe('getEventType', () => {
  it('returns "system" for system events', () => {
    const event: ClaudeStreamEvent = { type: 'system', subtype: 'init', session_id: 'x', tools: [], model: 'test', cwd: '/tmp' };
    expect(getEventType(event)).toBe('system');
  });

  it('returns "assistant" for text-only assistant events', () => {
    const event: ClaudeStreamEvent = {
      type: 'assistant',
      message: { id: '1', role: 'assistant', content: [{ type: 'text', text: 'hi' }], model: 'test', stop_reason: null },
    };
    expect(getEventType(event)).toBe('assistant');
  });

  it('returns "tool_use" for assistant events with tools', () => {
    const event: ClaudeStreamEvent = {
      type: 'assistant',
      message: {
        id: '1',
        role: 'assistant',
        content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }],
        model: 'test',
        stop_reason: 'tool_use',
      },
    };
    expect(getEventType(event)).toBe('tool_use');
  });

  it('returns "result" for non-error result events', () => {
    const event: ClaudeStreamEvent = {
      type: 'result', subtype: 'success', duration_ms: 0, duration_api_ms: 0,
      is_error: false, num_turns: 0, result: '', session_id: '', total_cost_usd: 0,
    };
    expect(getEventType(event)).toBe('result');
  });

  it('returns "error" for error result events', () => {
    const event: ClaudeStreamEvent = {
      type: 'result', subtype: 'error', duration_ms: 0, duration_api_ms: 0,
      is_error: true, num_turns: 0, result: 'fail', session_id: '', total_cost_usd: 0,
    };
    expect(getEventType(event)).toBe('error');
  });
});
