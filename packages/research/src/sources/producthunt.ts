import { TavilySource } from './tavily.js';

export class ProductHuntSource extends TavilySource {
  override name = 'producthunt';

  constructor() {
    super('site:producthunt.com');
  }
}
