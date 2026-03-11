import { describe, it, expect, vi } from 'vitest';
import { ResearchService } from '../researcher.js';
import type { ResearchSource, Signal } from '../types.js';

function mockSource(name: string, signals: Signal[]): ResearchSource {
  return {
    name,
    gather: vi.fn().mockResolvedValue(signals),
  };
}

function mockFailingSource(name: string): ResearchSource {
  return {
    name,
    gather: vi.fn().mockRejectedValue(new Error('Source failed')),
  };
}

describe('ResearchService', () => {
  it('aggregates signals from multiple sources', async () => {
    const service = new ResearchService();
    service.addSource(mockSource('src1', [
      { source: 'src1', type: 'trend', title: 'T1', summary: 'S1', relevance: 0.9 },
    ]));
    service.addSource(mockSource('src2', [
      { source: 'src2', type: 'competitor', title: 'T2', summary: 'S2', relevance: 0.8 },
    ]));

    const result = await service.gather({ theme: 'AI' }, 'key');

    expect(result.signals).toHaveLength(2);
    expect(result.sourcesUsed).toEqual(['src1', 'src2']);
    expect(result.totalSignals).toBe(2);
    expect(result.sourceResults).toHaveLength(2);
    expect(result.sourceResults[0]).toEqual({ name: 'src1', signals: expect.any(Array), count: 1 });
    expect(result.sourceResults[1]).toEqual({ name: 'src2', signals: expect.any(Array), count: 1 });
  });

  it('returns empty results with no sources', async () => {
    const service = new ResearchService();
    const result = await service.gather({ theme: 'AI' }, 'key');

    expect(result.signals).toHaveLength(0);
    expect(result.sourcesUsed).toHaveLength(0);
    expect(result.totalSignals).toBe(0);
    expect(result.sourceResults).toHaveLength(0);
  });

  it('handles source failures gracefully', async () => {
    const service = new ResearchService();
    service.addSource(mockSource('good', [
      { source: 'good', type: 'trend', title: 'T1', summary: 'S1', relevance: 0.9 },
    ]));
    service.addSource(mockFailingSource('bad'));

    const result = await service.gather({ theme: 'AI' }, 'key');

    expect(result.signals).toHaveLength(1);
    expect(result.sourcesUsed).toEqual(['good']);
  });

  it('runs sources in parallel', async () => {
    const delays: number[] = [];
    const slowSource: ResearchSource = {
      name: 'slow',
      gather: vi.fn().mockImplementation(async () => {
        const start = Date.now();
        await new Promise((r) => setTimeout(r, 50));
        delays.push(Date.now() - start);
        return [{ source: 'slow', type: 'trend' as const, title: 'T', summary: 'S', relevance: 0.5 }];
      }),
    };
    const fastSource: ResearchSource = {
      name: 'fast',
      gather: vi.fn().mockImplementation(async () => {
        const start = Date.now();
        await new Promise((r) => setTimeout(r, 10));
        delays.push(Date.now() - start);
        return [{ source: 'fast', type: 'news' as const, title: 'T', summary: 'S', relevance: 0.5 }];
      }),
    };

    const service = new ResearchService();
    service.addSource(slowSource);
    service.addSource(fastSource);

    const start = Date.now();
    const result = await service.gather({}, 'key');
    const totalTime = Date.now() - start;

    expect(result.signals).toHaveLength(2);
    // If run in parallel, total time should be ~50ms (max of both), not ~60ms (sum)
    expect(totalTime).toBeLessThan(100);
  });

  it('excludes failed sources from sourcesUsed', async () => {
    const service = new ResearchService();
    service.addSource(mockFailingSource('broken'));
    service.addSource(mockSource('working', [
      { source: 'working', type: 'news', title: 'T', summary: 'S', relevance: 0.5 },
    ]));

    const result = await service.gather({}, 'key');
    expect(result.sourcesUsed).toEqual(['working']);
    expect(result.sourcesUsed).not.toContain('broken');
  });

  it('keeps gathering when logger rejects', async () => {
    const service = new ResearchService();
    service.addSource(mockSource('src1', [
      { source: 'src1', type: 'trend', title: 'T1', summary: 'S1', relevance: 0.9 },
    ]));

    const onLog = vi.fn().mockRejectedValue(new Error('log failed'));

    const result = await service.gather({ theme: 'AI' }, 'key', onLog);

    expect(result.signals).toHaveLength(1);
    expect(result.sourcesUsed).toEqual(['src1']);
    expect(onLog).toHaveBeenCalledWith('Scanning 1 sources: src1');
  });
});
