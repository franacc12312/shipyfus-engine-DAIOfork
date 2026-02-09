export interface SystemInitEvent {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  model: string;
  cwd: string;
}

export interface ContentBlockText {
  type: 'text';
  text: string;
}

export interface ContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ContentBlockToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type ContentBlock = ContentBlockText | ContentBlockToolUse | ContentBlockToolResult;

export interface AssistantEvent {
  type: 'assistant';
  message: {
    id: string;
    role: 'assistant';
    content: ContentBlock[];
    model: string;
    stop_reason: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface ResultEvent {
  type: 'result';
  subtype: string;
  duration_ms: number;
  duration_api_ms: number;
  is_error: boolean;
  num_turns: number;
  result: string;
  session_id: string;
  total_cost_usd: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export type ClaudeStreamEvent = SystemInitEvent | AssistantEvent | ResultEvent;

export function parseStreamLine(line: string): ClaudeStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.type === 'string') {
      return parsed as ClaudeStreamEvent;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractTextFromEvent(event: ClaudeStreamEvent): string {
  if (event.type === 'assistant') {
    return event.message.content
      .filter((b): b is ContentBlockText => b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
  if (event.type === 'result') {
    return event.result || '';
  }
  return '';
}

export function getEventType(event: ClaudeStreamEvent): string {
  if (event.type === 'system') return 'system';
  if (event.type === 'assistant') {
    const hasToolUse = event.message.content.some((b) => b.type === 'tool_use');
    return hasToolUse ? 'tool_use' : 'assistant';
  }
  if (event.type === 'result') return event.is_error ? 'error' : 'result';
  return 'unknown';
}
