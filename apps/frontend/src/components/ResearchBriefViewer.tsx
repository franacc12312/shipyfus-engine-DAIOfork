import { useState } from 'react';
import { AdminGate } from './AdminGate';
import { approveStage, rejectStage } from '../lib/hitl';
import type { RunStage } from '@daio/shared';

interface ResearchBriefViewerProps {
  runId: string;
  stage: RunStage;
  onApproved?: () => void;
}

function parseMarkdownSections(markdown: string): { heading: string; items: string[] }[] {
  const sections: { heading: string; items: string[] }[] = [];
  const lines = markdown.split('\n');
  let current: { heading: string; items: string[] } | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.replace('## ', ''), items: [] };
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        current.items.push(trimmed.slice(2));
      } else if (trimmed.length > 0) {
        current.items.push(trimmed);
      }
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function ResearchBriefViewer({ runId, stage, onApproved }: ResearchBriefViewerProps) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const ctx = stage.output_context as { markdown?: string } | null;
  const markdown = ctx?.markdown ?? '';

  async function handleApprove() {
    setApproving(true);
    try {
      await approveStage(runId, 'research');
      onApproved?.();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
    setApproving(false);
  }

  async function handleRetry() {
    setRejecting(true);
    try {
      await rejectStage(runId, 'research', 'retry');
    } catch (err) {
      console.error('Failed to retry:', err);
    }
    setRejecting(false);
  }

  async function handleCancel() {
    setRejecting(true);
    try {
      await rejectStage(runId, 'research', 'cancel');
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
    setRejecting(false);
    setShowConfirm(false);
  }

  if (!markdown) {
    return (
      <div className="bg-terminal-cyan/5 border border-terminal-cyan/30 rounded-lg p-4 mb-4">
        <p className="text-xs text-zinc-400">No research brief available.</p>
      </div>
    );
  }

  const sections = parseMarkdownSections(markdown);

  return (
    <div className="bg-terminal-cyan/5 border border-terminal-cyan/30 rounded-lg p-4 mb-4 animate-pulse-slow">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-terminal-cyan animate-pulse" />
        <span className="text-sm font-bold text-terminal-cyan tracking-wider uppercase">
          Review Research Brief
        </span>
      </div>

      <div className="bg-zinc-950/50 rounded p-3 mb-3 max-h-80 overflow-auto space-y-3">
        {sections.map((section) => (
          <div key={section.heading}>
            <h3 className="text-xs font-bold text-terminal-cyan/80 uppercase tracking-wider mb-1">
              {section.heading}
            </h3>
            {section.items.length === 1 && !section.items[0].startsWith('-') ? (
              <p className="text-xs text-zinc-300 leading-relaxed">{section.items[0]}</p>
            ) : (
              <ul className="space-y-0.5">
                {section.items.map((item, i) => (
                  <li key={i} className="text-xs text-zinc-300 leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-terminal-cyan/50">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <AdminGate>
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            className="bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-4 py-1.5 text-xs tracking-wider hover:bg-terminal-green/30 transition disabled:opacity-50"
          >
            {approving ? 'APPROVING...' : 'APPROVE & CONTINUE'}
          </button>

          <button
            onClick={handleRetry}
            disabled={approving || rejecting}
            className="text-terminal-amber border border-terminal-amber/30 rounded px-3 py-1.5 text-xs tracking-wider hover:bg-terminal-amber/10 transition disabled:opacity-50"
          >
            {rejecting ? 'RETRYING...' : 'RE-RUN RESEARCH'}
          </button>

          {showConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400">Cancel entire run?</span>
              <button
                onClick={handleCancel}
                disabled={rejecting}
                className="text-terminal-red border border-terminal-red/30 rounded px-2 py-1 text-[10px] hover:bg-terminal-red/10 transition disabled:opacity-50"
              >
                YES, CANCEL
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-zinc-400 text-[10px] hover:text-zinc-200"
              >
                NO
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={approving || rejecting}
              className="text-terminal-red border border-terminal-red/30 rounded px-3 py-1.5 text-xs tracking-wider hover:bg-terminal-red/10 transition disabled:opacity-50"
            >
              CANCEL RUN
            </button>
          )}
        </AdminGate>
      </div>
    </div>
  );
}
