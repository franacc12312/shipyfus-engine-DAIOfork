import { useEffect, useRef, useState } from 'react';
import type { Agent, Log } from '@daio/shared';
import { ChatMessage, type ToolDetails } from './ChatMessage';

interface ChatStreamProps {
  logs: Log[];
  agents: Record<string, Agent>;
  agentsById: Record<string, Agent>;
  isRunning?: boolean;
  stageFilter?: string | null;
}

interface MessageGroup {
  key: string;
  agent: Agent | null;
  eventType: string;
  content: string;
  timestamp: string;
  stage: string;
  iteration: number;
  toolDetails?: ToolDetails;
}

function resolveAgent(
  log: Log,
  agentsById: Record<string, Agent>,
  agentsByStage: Record<string, Agent>,
): Agent | null {
  if (log.agent_id && agentsById[log.agent_id]) {
    return agentsById[log.agent_id];
  }
  return agentsByStage[log.stage] || null;
}

function extractToolDetails(log: Log): ToolDetails | undefined {
  if (log.event_type !== 'tool_use' || !log.raw_event) return undefined;

  const rawEvent = log.raw_event as {
    message?: { content?: Array<{ type: string; name?: string; input?: Record<string, unknown> }> };
  };

  const toolBlock = rawEvent.message?.content?.find((b) => b.type === 'tool_use');
  if (toolBlock?.name) {
    return {
      toolName: toolBlock.name,
      input: toolBlock.input || {},
    };
  }

  // Fallback: use content as tool name
  if (log.content) {
    return { toolName: log.content, input: {} };
  }

  return undefined;
}

function groupLogs(
  logs: Log[],
  agentsById: Record<string, Agent>,
  agentsByStage: Record<string, Agent>,
): { groups: MessageGroup[]; stageTransitions: Map<number, Agent | null>; iterationChanges: Map<number, { agent: Agent | null; iteration: number }> } {
  const groups: MessageGroup[] = [];
  const stageTransitions = new Map<number, Agent | null>();
  const iterationChanges = new Map<number, { agent: Agent | null; iteration: number }>();

  let prevStage = '';
  let prevIteration = 0;

  for (const log of logs) {
    // Skip empty content
    if (!log.content || !log.content.trim()) continue;

    const agent = resolveAgent(log, agentsById, agentsByStage);

    // Detect stage transition
    if (log.stage !== prevStage && prevStage !== '') {
      stageTransitions.set(groups.length, agent);
    }
    prevStage = log.stage;

    // Detect iteration change (development stage)
    if (log.stage === 'development' && log.iteration > prevIteration) {
      iterationChanges.set(groups.length, { agent, iteration: log.iteration });
    }
    if (log.iteration > prevIteration) prevIteration = log.iteration;

    const prev = groups[groups.length - 1];
    const timeDiff = prev
      ? new Date(log.timestamp).getTime() - new Date(prev.timestamp).getTime()
      : Infinity;

    // Merge consecutive assistant events from same agent within 5s
    if (
      prev &&
      log.event_type === 'assistant' &&
      prev.eventType === 'assistant' &&
      log.agent_id === (prev.agent?.id || null) &&
      log.stage === prev.stage &&
      timeDiff < 5000
    ) {
      prev.content += '\n' + log.content;
      prev.timestamp = log.timestamp;
    } else {
      const toolDetails = extractToolDetails(log);
      groups.push({
        key: `msg-${log.id}`,
        agent,
        eventType: log.event_type,
        content: log.content,
        timestamp: log.timestamp,
        stage: log.stage,
        iteration: log.iteration,
        toolDetails,
      });
    }
  }

  return { groups, stageTransitions, iterationChanges };
}

export function ChatStream({ logs, agents, agentsById, isRunning, stageFilter }: ChatStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredLogs = stageFilter
    ? logs.filter((l) => l.stage === stageFilter)
    : logs;

  const { groups, stageTransitions, iterationChanges } = groupLogs(filteredLogs, agentsById, agents);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [groups.length, autoScroll]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs overflow-auto"
      style={{ height: '600px' }}
    >
      <div className="p-3 space-y-2">
        {groups.length === 0 ? (
          <div className="text-zinc-600 py-4 text-center">
            {isRunning ? 'Waiting for messages...' : 'No messages available'}
          </div>
        ) : (
          groups.map((group, idx) => (
            <div key={group.key}>
              {/* Stage transition separator */}
              {stageTransitions.has(idx) && (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex-1 border-t border-zinc-800" />
                  <span className="text-zinc-500 text-[10px]">
                    {stageTransitions.get(idx)?.name || 'Agent'} has entered the conversation
                  </span>
                  <div className="flex-1 border-t border-zinc-800" />
                </div>
              )}

              {/* Iteration separator */}
              {iterationChanges.has(idx) && (
                <div className="text-center py-1">
                  <span className="text-terminal-cyan text-[10px] opacity-60">
                    ═══ {iterationChanges.get(idx)!.agent?.name || 'Agent'} — Iteration {iterationChanges.get(idx)!.iteration} ═══
                  </span>
                </div>
              )}

              <ChatMessage
                agent={group.agent}
                content={group.content}
                eventType={group.eventType}
                timestamp={group.timestamp}
                iteration={group.iteration}
                toolDetails={group.toolDetails}
              />
            </div>
          ))
        )}
        {isRunning && (
          <span className="inline-block w-2 h-4 bg-terminal-green blink" />
        )}
      </div>
    </div>
  );
}
