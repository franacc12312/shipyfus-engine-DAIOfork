import { useEffect, useRef, useState } from 'react';
import type { Log } from '@daio/shared';

const EVENT_COLORS: Record<string, string> = {
  system: 'text-zinc-500',
  assistant: 'text-terminal-green',
  tool_use: 'text-terminal-cyan',
  error: 'text-terminal-red',
  result: 'text-terminal-amber',
  unknown: 'text-zinc-400',
};

interface LogStreamProps {
  logs: Log[];
  isRunning?: boolean;
  stageFilter?: string | null;
}

export function LogStream({ logs, isRunning, stageFilter }: LogStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const filteredLogs = (stageFilter
    ? logs.filter((l) => l.stage === stageFilter)
    : logs
  ).filter((l) => l.content?.trim());

  // Auto-scroll behavior
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  function handleScroll() {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }

  // Group by iteration to insert separators
  let lastIteration = 0;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs overflow-auto"
      style={{ height: '600px' }}
    >
      <div className="p-3 space-y-0.5">
        {filteredLogs.length === 0 ? (
          <div className="text-zinc-600 py-4 text-center">
            {isRunning ? 'Waiting for logs...' : 'No logs available'}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const showSeparator = log.stage === 'development' && log.iteration > lastIteration;
            if (log.iteration > lastIteration) lastIteration = log.iteration;

            return (
              <div key={log.id}>
                {showSeparator && (
                  <div className="text-terminal-cyan text-center py-1 opacity-60">
                    ═══ Iteration {log.iteration} ═══
                  </div>
                )}
                <div className="flex gap-2 leading-relaxed">
                  <span className="text-zinc-600 shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span className="text-zinc-500 shrink-0">[{log.stage}]</span>
                  {log.stage === 'development' && log.iteration > 0 && (
                    <span className="text-zinc-600 shrink-0">[i{log.iteration}]</span>
                  )}
                  <span className={EVENT_COLORS[log.event_type] || EVENT_COLORS.unknown}>
                    {log.content}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {isRunning && (
          <span className="inline-block w-2 h-4 bg-terminal-green blink" />
        )}
      </div>
    </div>
  );
}
