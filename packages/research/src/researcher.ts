import type { ResearchContext, ResearchLogFn, ResearchSource, RawResearchData } from './types.js';

export class ResearchService {
  private sources: ResearchSource[] = [];

  addSource(source: ResearchSource): void {
    this.sources.push(source);
  }

  async gather(context: ResearchContext, apiKey: string, onLog?: ResearchLogFn): Promise<RawResearchData> {
    if (this.sources.length === 0) {
      return { signals: [], sourcesUsed: [], totalSignals: 0, sourceResults: [] };
    }

    const sourceNames = this.sources.map((s) => s.name);
    await onLog?.(`Scanning ${this.sources.length} sources: ${sourceNames.join(', ')}`);

    const results = await Promise.all(
      this.sources.map(async (source) => {
        await onLog?.(`--- ${source.name} ---`);
        try {
          const signals = await source.gather(context, apiKey);
          if (signals.length > 0) {
            const typeBreakdown = this.summarizeTypes(signals.map((s) => s.type));
            await onLog?.(`${source.name} complete: ${signals.length} signals (${typeBreakdown})`);
          } else {
            await onLog?.(`${source.name} complete: no signals found`);
          }
          return { name: source.name, signals };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await onLog?.(`${source.name} failed: ${msg}`);
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

    if (allSignals.length > 0) {
      const typeBreakdown = this.summarizeTypes(allSignals.map((s) => s.type));
      await onLog?.(`Total: ${allSignals.length} signals from ${sourcesUsed.length}/${this.sources.length} sources (${typeBreakdown})`);
    }

    return {
      signals: allSignals,
      sourcesUsed,
      totalSignals: allSignals.length,
      sourceResults,
    };
  }

  private summarizeTypes(types: string[]): string {
    const counts = new Map<string, number>();
    for (const t of types) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
  }
}
