import { useState } from 'react';
import { AdminGate } from './AdminGate';
import { ResearchBriefViewer } from './ResearchBriefViewer';
import { DomainPicker } from './DomainPicker';
import { approveStage, rejectStage } from '../lib/hitl';
import type { RunStage } from '@daio/shared';

const STAGE_LABELS: Record<string, string> = {
  research: 'Research',
  ideation: 'Ideation',
  branding: 'Branding',
  planning: 'Planning',
  development: 'Development',
};

interface ApprovalGateProps {
  runId: string;
  stage: RunStage;
  onApproved?: () => void;
  onViewDocs?: () => void;
}

export function ApprovalGate({ runId, stage, onApproved, onViewDocs }: ApprovalGateProps) {
  // Route research stage to the dedicated brief viewer
  if (stage.stage === 'research') {
    return <ResearchBriefViewer runId={runId} stage={stage} onApproved={onApproved} />;
  }

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPrd, setShowPrd] = useState(false);

  // Delegate to DomainPicker for branding stage with candidates
  const ctx = stage.output_context as Record<string, unknown> | null;
  if (stage.stage === 'branding' && ctx?.candidates) {
    return <DomainPicker runId={runId} stage={stage} onApproved={onApproved} />;
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await approveStage(runId, stage.stage);
      onApproved?.();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
    setApproving(false);
  }

  async function handleRetry() {
    setRejecting(true);
    try {
      await rejectStage(runId, stage.stage, 'retry');
    } catch (err) {
      console.error('Failed to retry:', err);
    }
    setRejecting(false);
  }

  async function handleCancel() {
    setRejecting(true);
    try {
      await rejectStage(runId, stage.stage, 'cancel');
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
    setRejecting(false);
    setShowConfirm(false);
  }

  return (
    <div className="bg-terminal-amber/5 border border-terminal-amber/30 rounded-lg p-4 mb-4 animate-pulse-slow">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-terminal-amber animate-pulse" />
        <span className="text-sm font-bold text-terminal-amber tracking-wider uppercase">
          Approval Required
        </span>
      </div>

      <p className="text-xs text-zinc-300 mb-1">
        <span className="text-zinc-500">Stage:</span>{' '}
        <span className="text-terminal-amber">{STAGE_LABELS[stage.stage] || stage.stage}</span>{' '}
        has completed and is awaiting your review.
      </p>

      {stage.output_context && (() => {
        const oc = stage.output_context as Record<string, unknown>;
        return (
          <div className="mt-2 mb-3 space-y-2">
            <div className="bg-zinc-950/50 rounded p-2 text-[10px] text-zinc-400">
              {stage.stage === 'ideation' && oc.productName ? (
                <span>Product: <span className="text-zinc-200">{String(oc.productName)}</span></span>
              ) : stage.stage === 'planning' && oc.phases ? (
                <span>Phases: <span className="text-zinc-200">{Array.isArray(oc.phases) ? oc.phases.length : '?'}</span>, Tasks: <span className="text-zinc-200">{Array.isArray(oc.phases) ? (oc.phases as Array<{ tasks?: unknown[] }>).reduce((sum, p) => sum + (Array.isArray(p.tasks) ? p.tasks.length : 0), 0) : '?'}</span></span>
              ) : stage.stage === 'development' && 'completed' in oc ? (
                <span>
                  Status: <span className={oc.completed ? 'text-terminal-green' : 'text-terminal-amber'}>{oc.completed ? 'COMPLETE' : 'IN PROGRESS'}</span>
                  , Iterations: <span className="text-zinc-200">{String(oc.iterations ?? '?')}</span>
                  {oc.cost_usd != null && <>, Cost: <span className="text-zinc-200">${Number(oc.cost_usd).toFixed(2)}</span></>}
                </span>
              ) : (
                <span className="text-zinc-500">Output available</span>
              )}
            </div>

            {stage.stage === 'ideation' && !!oc.productName && (
              <>
                <button
                  onClick={() => setShowPrd((v) => !v)}
                  className="text-[10px] text-terminal-cyan hover:text-terminal-cyan/80 tracking-wider transition"
                >
                  {showPrd ? '▾ HIDE PRD' : '▸ VIEW PRD'}
                </button>
                {showPrd && (
                  <div className="bg-zinc-950/50 rounded p-3 text-[10px] text-zinc-400 max-h-64 overflow-auto space-y-1.5">
                    {!!oc.productDescription && <div><span className="text-zinc-500">Description:</span> <span className="text-zinc-200">{String(oc.productDescription)}</span></div>}
                    {!!oc.targetUser && <div><span className="text-zinc-500">Target User:</span> <span className="text-zinc-200">{String(oc.targetUser)}</span></div>}
                    {!!oc.problemStatement && <div><span className="text-zinc-500">Problem:</span> <span className="text-zinc-200">{String(oc.problemStatement)}</span></div>}
                    {Array.isArray(oc.coreFunctionality) && oc.coreFunctionality.length > 0 && (
                      <div>
                        <span className="text-zinc-500">Core Features:</span>
                        <ul className="list-disc list-inside ml-1 mt-0.5 space-y-0.5">
                          {(oc.coreFunctionality as string[]).map((f, i) => <li key={i} className="text-zinc-200">{f}</li>)}
                        </ul>
                      </div>
                    )}
                    {!!oc.mvpScope && <div><span className="text-zinc-500">MVP Scope:</span> <span className="text-zinc-200">{String(oc.mvpScope)}</span></div>}
                    {!!oc.uniqueValue && <div><span className="text-zinc-500">Unique Value:</span> <span className="text-zinc-200">{String(oc.uniqueValue)}</span></div>}
                  </div>
                )}
              </>
            )}

            {stage.stage === 'planning' && onViewDocs && (
              <button
                onClick={onViewDocs}
                className="text-[10px] text-terminal-cyan hover:text-terminal-cyan/80 tracking-wider transition"
              >
                ▸ VIEW PLAN
              </button>
            )}

            {stage.stage === 'development' && onViewDocs && (
              <button
                onClick={onViewDocs}
                className="text-[10px] text-terminal-cyan hover:text-terminal-cyan/80 tracking-wider transition"
              >
                ▸ VIEW PROGRESS
              </button>
            )}
          </div>
        );
      })()}

      <div className="flex gap-2 mt-3">
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
            {rejecting ? 'RETRYING...' : 'RETRY STAGE'}
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
