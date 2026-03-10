import type { ResearchLogFn } from '../types.js';
import { TavilySource } from './tavily.js';

export class RedditSource extends TavilySource {
  override name = 'reddit';

  constructor(onLog?: ResearchLogFn) {
    super('site:reddit.com', onLog);
  }
}
