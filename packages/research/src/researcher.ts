import type { ResearchContext, ResearchSource, RawResearchData } from './types.js';

export class ResearchService {
  private sources: ResearchSource[] = [];

  addSource(source: ResearchSource): void {
    this.sources.push(source);
  }

  async gather(context: ResearchContext, apiKey: string): Promise<RawResearchData> {
    if (this.sources.length === 0) {
      return { signals: [], sourcesUsed: [], totalSignals: 0, sourceResults: [] };
    }

    const results = await Promise.all(
      this.sources.map(async (source) => {
        try {
          const signals = await source.gather(context, apiKey);
          return { name: source.name, signals };
        } catch (err) {
          console.warn(`Research source "${source.name}" failed:`, err);
          return { name: source.name, signals: [] };
        }
      }),
    );

    const allSignals = results.flatMap((r) => r.signals);
    const sourcesUsed = results.filter((r) => r.signals.length > 0).map((r) => r.name);
    const sourceResults = results.map((r) => ({
      name: r.name,
      signals: r.signals,
      count: r.signals.length,
    }));

    return {
      signals: allSignals,
      sourcesUsed,
      totalSignals: allSignals.length,
      sourceResults,
    };
  }
}
