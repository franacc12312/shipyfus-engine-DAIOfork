import { TavilySource } from './tavily.js';

export class HackerNewsSource extends TavilySource {
  override name = 'hackernews';

  constructor() {
    super('site:news.ycombinator.com');
  }
}
