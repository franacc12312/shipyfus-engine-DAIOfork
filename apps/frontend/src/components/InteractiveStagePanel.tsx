import { useMemo, useState } from 'react';
import { AdminGate } from './AdminGate';
import { continueInteractiveStage, rejectStage, sendStageMessage } from '../lib/hitl';
import type { RunStage, StageMessage } from '@daio/shared';

const STAGE_LABELS: Record<string, string> = {
  research: 'Research',
  ideation: 'Ideation',
  branding: 'Branding',
  planning: 'Planning',
  development: 'Development',
  deployment: 'Deployment',
  distribution: 'Distribution',
};

interface InteractiveStagePanelProps {
  runId: string;
  stage: RunStage;
  messages: StageMessage[];
  onUpdated?: () => void;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export function InteractiveStagePanel({ runId, stage, messages, onUpdated }: InteractiveStagePanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showPrd, setShowPrd] = useState(false);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages],
  );

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;

    setSending(true);
    try {
      await sendStageMessage(runId, stage.stage, content);
      await continueInteractiveStage(runId, stage.stage);
      setDraft('');
      await onUpdated?.();
    } finally {
      setSending(false);
    }
  }

  async function handleContinue() {
    setContinuing(true);
    try {
      await continueInteractiveStage(runId, stage.stage);
      await onUpdated?.();
    } finally {
      setContinuing(false);
    }
  }

  async function handleReject(action: 'retry' | 'cancel') {
    setRejecting(true);
    try {
      await rejectStage(runId, stage.stage, action);
      await onUpdated?.();
    } finally {
      setRejecting(false);
    }
  }

  const oc = (stage.output_context || {}) as Record<string, unknown>;

  return (
    <div className="mb-4 rounded-lg border border-terminal-cyan/30 bg-terminal-cyan/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-terminal-cyan animate-pulse" />
        <span className="text-sm font-bold uppercase tracking-wider text-terminal-cyan">Interactive Review</span>
      </div>

      <p className="text-xs text-zinc-300">
        <span className="text-zinc-500">Stage:</span>{' '}
        <span className="text-terminal-cyan">{STAGE_LABELS[stage.stage] || stage.stage}</span>{' '}
        is waiting for your direction.
      </p>
      <p className="mt-1 text-[11px] text-zinc-500">
        Add feedback to trigger another ideation pass immediately, or continue as-is to move on.
      </p>

      {stage.stage === 'ideation' && !!oc.productName && (
        <div className="mt-3">
          <button
            onClick={() => setShowPrd((value) => !value)}
            className="text-[10px] tracking-wider text-terminal-cyan transition hover:text-terminal-cyan/80"
          >
            {showPrd ? '▾ HIDE CURRENT PRD' : '▸ VIEW CURRENT PRD'}
          </button>
          {showPrd && (
            <div className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950/50 p-3 text-[10px] text-zinc-400 space-y-1.5">
              {!!oc.productDescription && <div><span className="text-zinc-500">Description:</span> <span className="text-zinc-200">{String(oc.productDescription)}</span></div>}
              {!!oc.targetUser && <div><span className="text-zinc-500">Target User:</span> <span className="text-zinc-200">{String(oc.targetUser)}</span></div>}
              {!!oc.problemStatement && <div><span className="text-zinc-500">Problem:</span> <span className="text-zinc-200">{String(oc.problemStatement)}</span></div>}
              {Array.isArray(oc.coreFunctionality) && oc.coreFunctionality.length > 0 && (
                <div>
                  <span className="text-zinc-500">Core Features:</span>
                  <ul className="ml-1 mt-0.5 list-disc list-inside space-y-0.5">
                    {(oc.coreFunctionality as string[]).map((feature, index) => (
                      <li key={index} className="text-zinc-200">{feature}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!oc.mvpScope && <div><span className="text-zinc-500">MVP Scope:</span> <span className="text-zinc-200">{String(oc.mvpScope)}</span></div>}
              {!!oc.uniqueValue && <div><span className="text-zinc-500">Unique Value:</span> <span className="text-zinc-200">{String(oc.uniqueValue)}</span></div>}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
        {orderedMessages.length === 0 ? (
          <div className="text-[11px] text-zinc-500">No interactive messages yet.</div>
        ) : orderedMessages.map((message) => (
          <div
            key={message.id}
            className={`rounded border px-3 py-2 ${
              message.role === 'user'
                ? 'border-terminal-cyan/30 bg-terminal-cyan/10'
                : message.role === 'assistant'
                  ? 'border-zinc-800 bg-zinc-900'
                  : 'border-zinc-800/80 bg-zinc-950'
            }`}
          >
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <span>{message.role}</span>
              <span>{formatTimestamp(message.created_at)}</span>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-xs text-zinc-200">{message.content}</div>
          </div>
        ))}
      </div>

      <AdminGate>
        <div className="mt-4 space-y-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Give the stage more direction..."
            rows={4}
            className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-terminal-cyan/50"
          />

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSend}
              disabled={sending || continuing || rejecting || !draft.trim()}
              className="rounded border border-terminal-cyan/30 px-4 py-1.5 text-xs tracking-wider text-terminal-cyan transition hover:bg-terminal-cyan/10 disabled:opacity-50"
            >
              {sending ? 'SENDING...' : 'SEND FEEDBACK'}
            </button>
            <button
              onClick={handleContinue}
              disabled={continuing || rejecting}
              className="rounded border border-terminal-green/30 bg-terminal-green/20 px-4 py-1.5 text-xs tracking-wider text-terminal-green transition hover:bg-terminal-green/30 disabled:opacity-50"
            >
              {continuing ? 'CONTINUING...' : 'CONTINUE AS-IS'}
            </button>
            <button
              onClick={() => handleReject('retry')}
              disabled={continuing || rejecting}
              className="rounded border border-terminal-amber/30 px-3 py-1.5 text-xs tracking-wider text-terminal-amber transition hover:bg-terminal-amber/10 disabled:opacity-50"
            >
              {rejecting ? 'WORKING...' : 'RETRY STAGE'}
            </button>
            <button
              onClick={() => handleReject('cancel')}
              disabled={continuing || rejecting}
              className="rounded border border-terminal-red/30 px-3 py-1.5 text-xs tracking-wider text-terminal-red transition hover:bg-terminal-red/10 disabled:opacity-50"
            >
              CANCEL RUN
            </button>
          </div>
        </div>
      </AdminGate>
    </div>
  );
}
