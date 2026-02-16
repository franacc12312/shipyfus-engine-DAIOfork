// Signal types from data sources
export type SignalType =
  | 'trend'
  | 'competitor'
  | 'pain_point'
  | 'opportunity'
  | 'discussion'
  | 'launch'
  | 'news'
  | 'unknown';

export interface Signal {
  source: string;
  type: SignalType;
  title: string;
  summary: string;
  url?: string;
  relevance: number; // 0-1
}

export interface ResearchContext {
  theme?: string;
  category?: string;
  platform?: string;
  audience?: string;
  topics?: string[];
}

export interface ResearchSource {
  name: string;
  gather(context: ResearchContext, apiKey: string): Promise<Signal[]>;
}

export interface SourceResult {
  name: string;
  signals: Signal[];
  count: number;
}

export interface RawResearchData {
  signals: Signal[];
  sourcesUsed: string[];
  totalSignals: number;
  sourceResults: SourceResult[];
}

export interface ResearchBrief {
  marketTrends: string[];
  competitorAnalysis: string[];
  painPoints: string[];
  opportunities: string[];
  relevantDiscussions: string[];
  summary: string;
}

// Tavily API types
export interface TavilySearchRequest {
  api_key: string;
  query: string;
  max_results?: number;
  search_depth?: 'basic' | 'advanced';
  include_answer?: boolean;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: TavilySearchResult[];
  answer?: string;
}

export function classifySignalType(text: string): SignalType {
  const lower = text.toLowerCase();
  if (lower.includes('trend') || lower.includes('growing') || lower.includes('rising')) return 'trend';
  if (lower.includes('competitor') || lower.includes('alternative') || lower.includes('vs')) return 'competitor';
  if (lower.includes('pain') || lower.includes('problem') || lower.includes('frustrat') || lower.includes('struggle')) return 'pain_point';
  if (lower.includes('opportunity') || lower.includes('gap') || lower.includes('missing') || lower.includes('need')) return 'opportunity';
  if (lower.includes('launch') || lower.includes('released') || lower.includes('announce') || lower.includes('new product')) return 'launch';
  if (lower.includes('discussion') || lower.includes('thread') || lower.includes('comment')) return 'discussion';
  if (lower.includes('news') || lower.includes('report') || lower.includes('study')) return 'news';
  return 'unknown';
}
