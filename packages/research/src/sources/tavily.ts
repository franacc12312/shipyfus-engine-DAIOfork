import type { ResearchContext, ResearchLogFn, ResearchSource, Signal, TavilySearchResponse } from '../types.js';
import { classifySignalType } from '../types.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

export function buildQueries(context: ResearchContext): string[] {
  const queries: string[] = [];
  const parts: string[] = [];

  if (context.theme) parts.push(context.theme);
  if (context.category) parts.push(context.category);
  if (context.platform) parts.push(`${context.platform} app`);
  if (context.audience) parts.push(`for ${context.audience}`);

  // Main query from context
  if (parts.length > 0) {
    queries.push(`${parts.join(' ')} software trends 2026`);
  }

  // Topic-specific queries
  if (context.topics?.length) {
    for (const topic of context.topics.slice(0, 3)) {
      queries.push(`${topic} software market trends`);
    }
  }

  // Fallback if no context provided
  if (queries.length === 0) {
    queries.push('trending software tools 2026');
  }

  return queries;
}

export class TavilySource implements ResearchSource {
  name = 'tavily';
  protected sitePrefix: string;
  protected onLog?: ResearchLogFn;

  constructor(sitePrefix?: string, onLog?: ResearchLogFn) {
    this.sitePrefix = sitePrefix ?? '';
    this.onLog = onLog;
  }

  async gather(context: ResearchContext, apiKey: string): Promise<Signal[]> {
    const queries = buildQueries(context);
    const signals: Signal[] = [];

    for (const query of queries) {
      const fullQuery = this.sitePrefix ? `${this.sitePrefix} ${query}` : query;
      try {
        await this.onLog?.(`  Searching: "${query}"`);
        const results = await this.search(fullQuery, apiKey);
        if (results.length > 0) {
          await this.onLog?.(`  Found ${results.length} results`);
          for (const result of results) {
            signals.push({
              source: this.name,
              type: classifySignalType(result.title + ' ' + result.content),
              title: result.title,
              summary: result.content.slice(0, 500),
              url: result.url,
              relevance: result.score,
            });
          }
        } else {
          await this.onLog?.(`  No results for this query`);
        }
      } catch (err) {
        await this.onLog?.(`  Query failed: ${err instanceof Error ? err.message : String(err)}`);
        console.warn(`Tavily search failed for "${fullQuery}":`, err);
      }
    }

    return signals;
  }

  private async search(query: string, apiKey: string): Promise<TavilySearchResponse['results']> {
    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: 'basic',
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TavilySearchResponse;
    return data.results ?? [];
  }
}
