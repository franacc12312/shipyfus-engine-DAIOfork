import type { ResearchLogFn } from '../types.js';
import { TavilySource } from './tavily.js';

export class HackerNewsSource extends TavilySource {
  override name = 'hackernews';

  constructor(onLog?: ResearchLogFn) {
    super('site:news.ycombinator.com', onLog);
  }
}
