import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TavilySource, buildQueries } from '../sources/tavily.js';
import type { ResearchContext } from '../types.js';

describe('buildQueries', () => {
  it('builds queries from full context', () => {
    const ctx: ResearchContext = {
      theme: 'productivity',
      category: 'tools',
      platform: 'web',
      audience: 'developer',
    };
    const queries = buildQueries(ctx);
    expect(queries.length).toBeGreaterThanOrEqual(1);
    expect(queries[0]).toContain('productivity');
    expect(queries[0]).toContain('tools');
  });

  it('includes topic-specific queries', () => {
    const ctx: ResearchContext = {
      theme: 'AI',
      topics: ['code review', 'testing automation'],
    };
    const queries = buildQueries(ctx);
    expect(queries.length).toBe(3); // main + 2 topics
    expect(queries[1]).toContain('code review');
    expect(queries[2]).toContain('testing automation');
  });

  it('limits topics to 3', () => {
    const ctx: ResearchContext = {
      topics: ['a', 'b', 'c', 'd', 'e'],
    };
    const queries = buildQueries(ctx);
    // Only topic queries (no main since no theme/category/platform/audience)
    expect(queries.length).toBe(3);
  });

  it('returns fallback query when context is empty', () => {
    const queries = buildQueries({});
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('trending');
  });
});

describe('TavilySource', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('calls Tavily API with correct payload', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { title: 'Test Result', url: 'https://example.com', content: 'Some content', score: 0.9 },
        ],
      }),
    } as Response);

    const source = new TavilySource();
    const signals = await source.gather({ theme: 'AI tools' }, 'test-key');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('test-key'),
      }),
    );
    expect(signals).toHaveLength(1);
    expect(signals[0].source).toBe('tavily');
    expect(signals[0].title).toBe('Test Result');
  });

  it('parses response into signals', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { title: 'Growing trend in AI', url: 'https://example.com', content: 'AI is growing fast', score: 0.85 },
          { title: 'Pain point: slow builds', url: 'https://example.com/2', content: 'Developers struggle with slow builds', score: 0.7 },
        ],
      }),
    } as Response);

    const source = new TavilySource();
    const signals = await source.gather({ theme: 'devtools' }, 'key');

    expect(signals).toHaveLength(2);
    expect(signals[0].type).toBe('trend');
    expect(signals[1].type).toBe('pain_point');
    expect(signals[0].relevance).toBe(0.85);
  });

  it('handles API error gracefully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    } as Response);

    const source = new TavilySource();
    const signals = await source.gather({ theme: 'AI' }, 'bad-key');

    // Should not throw, returns empty
    expect(signals).toHaveLength(0);
  });

  it('handles network error gracefully', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'));

    const source = new TavilySource();
    const signals = await source.gather({ theme: 'AI' }, 'key');

    expect(signals).toHaveLength(0);
  });

  it('applies site prefix for scoped sources', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    } as Response);

    const source = new TavilySource('site:producthunt.com');
    await source.gather({ theme: 'AI' }, 'key');

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    expect(body.query).toContain('site:producthunt.com');
  });
});
