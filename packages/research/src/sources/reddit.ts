import { TavilySource } from './tavily.js';

export class RedditSource extends TavilySource {
  override name = 'reddit';

  constructor() {
    super('site:reddit.com');
  }
}
