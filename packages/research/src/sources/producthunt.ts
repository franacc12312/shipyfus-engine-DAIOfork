import type { ResearchLogFn } from '../types.js';
import { TavilySource } from './tavily.js';

export class ProductHuntSource extends TavilySource {
  override name = 'producthunt';

  constructor(onLog?: ResearchLogFn) {
    super('site:producthunt.com', onLog);
  }
}
