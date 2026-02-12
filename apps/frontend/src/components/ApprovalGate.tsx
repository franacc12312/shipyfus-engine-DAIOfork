import { useState } from 'react';
import { AdminGate } from './AdminGate';
import { DomainPicker } from './DomainPicker';
import { approveStage, rejectStage } from '../lib/hitl';
import type { RunStage } from '@daio/shared';

const STAGE_LABELS: Record<string, string> = {
  ideation: 'Ideation',
  branding: 'Branding',
  planning: 'Planning',
  development: 'Development',
};

interface ApprovalGateProps {
  runId: string;
  stage: RunStage;
}

export function ApprovalGate({ runId, stage }: ApprovalGateProps) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Delegate to DomainPicker for branding stage with candidates
  const ctx = stage.output_context as Record<string, unknown> | null;
  if (stage.stage === 'branding' && ctx?.candidates) {
    return <DomainPicker runId={runId} stage={stage} />;
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await approveStage(runId, stage.stage);
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

      {stage.output_context && (
        <div className="bg-zinc-950/50 rounded p-2 mt-2 mb-3 text-[10px] text-zinc-400 max-h-24 overflow-auto">
          {typeof stage.output_context === 'object' && 'productName' in stage.output_context ? (
            <span>Product: <span className="text-zinc-200">{String((stage.output_context as Record<string, unknown>).productName)}</span></span>
          ) : typeof stage.output_context === 'object' && 'completed' in stage.output_context ? (
            <span>Completed: <span className="text-zinc-200">{String((stage.output_context as Record<string, unknown>).completed)}</span>, Iterations: <span className="text-zinc-200">{String((stage.output_context as Record<string, unknown>).iterations)}</span></span>
          ) : (
            <span className="text-zinc-500">Output available</span>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <AdminGate fallback={null}>
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
