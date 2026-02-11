import { useState } from 'react';
import type { Agent } from '@daio/shared';

export interface ToolDetails {
  toolName: string;
  input: Record<string, unknown>;
}

interface ChatMessageProps {
  agent: Agent | null;
  content: string;
  eventType: string;
  timestamp: string;
  iteration?: number;
  toolDetails?: ToolDetails;
}

function AgentAvatar({ agent }: { agent: Agent | null }) {
  if (!agent) {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-xs font-bold shrink-0">
        ?
      </div>
    );
  }

  if (agent.avatar_url) {
    return (
      <img
        src={agent.avatar_url}
        alt={agent.name}
        className="w-8 h-8 rounded-full shrink-0 object-cover"
      />
    );
  }

  const color = agent.characteristics?.color || '#6b7280';
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-950 text-xs font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {agent.name[0]}
    </div>
  );
}

function MarkdownContent({ text }: { text: string }) {
  // Lightweight markdown: bold, inline code, code blocks, bullet lists
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <pre key={`code-${i}`} className="bg-zinc-800 rounded px-2 py-1 my-1 text-[10px] overflow-x-auto">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Bullet list
    if (line.match(/^\s*[-*]\s/)) {
      elements.push(
        <div key={`li-${i}`} className="pl-3 flex gap-1">
          <span className="text-zinc-500">-</span>
          <span>{renderInline(line.replace(/^\s*[-*]\s/, ''))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Regular line
    if (line.trim()) {
      elements.push(<div key={`p-${i}`}>{renderInline(line)}</div>);
    }
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  // Split by inline code first, then handle bold within non-code segments
  const parts: React.ReactNode[] = [];
  const codeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match;

  while ((match = codeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...renderBold(text.slice(lastIndex, match.index), `pre-${match.index}`));
    }
    parts.push(
      <code key={`ic-${match.index}`} className="bg-zinc-800 px-1 rounded text-terminal-cyan">
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(...renderBold(text.slice(lastIndex), `post-${lastIndex}`));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function renderBold(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${keyPrefix}-t-${match.index}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`${keyPrefix}-t-end`}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

function ToolUseCard({ toolDetails }: { toolDetails: ToolDetails }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded px-2 py-1.5 my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-terminal-cyan text-[10px] w-full text-left"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>&#9654;</span>
        <span>Used <strong>{toolDetails.toolName}</strong></span>
      </button>
      {expanded && (
        <div className="mt-1 pl-4 text-[10px] text-zinc-400 space-y-0.5">
          {Object.entries(toolDetails.input).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-zinc-500">{key}:</span>
              <span className="text-zinc-300 truncate">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ agent, content, eventType, timestamp, toolDetails }: ChatMessageProps) {
  const time = new Date(timestamp).toLocaleTimeString('en-US', { hour12: false });

  // System events: centered, no bubble
  if (eventType === 'system') {
    return (
      <div className="text-center text-zinc-500 text-[10px] py-1 chat-message-enter">
        <span className="text-zinc-600">{time}</span> {content}
      </div>
    );
  }

  // Tool use events
  if (eventType === 'tool_use' && toolDetails) {
    return (
      <div className="flex gap-2 items-start chat-message-enter">
        <AgentAvatar agent={agent} />
        <div className="flex-1 min-w-0">
          <ToolUseCard toolDetails={toolDetails} />
        </div>
        <span className="text-zinc-600 text-[10px] shrink-0 pt-1">{time}</span>
      </div>
    );
  }

  // Error events
  if (eventType === 'error') {
    return (
      <div className="flex gap-2 items-start chat-message-enter">
        <AgentAvatar agent={agent} />
        <div className="flex-1 min-w-0">
          <div className="bg-zinc-900 border border-zinc-800 border-l-2 border-l-terminal-red rounded-lg p-3">
            <MarkdownContent text={content} />
          </div>
        </div>
        <span className="text-zinc-600 text-[10px] shrink-0 pt-1">{time}</span>
      </div>
    );
  }

  // Result events
  if (eventType === 'result') {
    return (
      <div className="flex gap-2 items-start chat-message-enter">
        <AgentAvatar agent={agent} />
        <div className="flex-1 min-w-0">
          {agent && (
            <div className="text-[10px] text-zinc-500 mb-0.5">{agent.name}</div>
          )}
          <div className="bg-zinc-900 border border-zinc-800 border-l-2 border-l-terminal-amber rounded-lg p-3">
            <MarkdownContent text={content} />
          </div>
        </div>
        <span className="text-zinc-600 text-[10px] shrink-0 pt-1">{time}</span>
      </div>
    );
  }

  // Assistant events (default)
  return (
    <div className="flex gap-2 items-start chat-message-enter">
      <AgentAvatar agent={agent} />
      <div className="flex-1 min-w-0">
        {agent && (
          <div className="text-[10px] text-zinc-500 mb-0.5">
            {agent.name} <span className="text-zinc-600">· {agent.role_description}</span>
          </div>
        )}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <MarkdownContent text={content} />
        </div>
      </div>
      <span className="text-zinc-600 text-[10px] shrink-0 pt-1">{time}</span>
    </div>
  );
}
