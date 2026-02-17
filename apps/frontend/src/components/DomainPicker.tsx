import { useState } from 'react';
import { AdminGate } from './AdminGate';
import { approveStage, rejectStage } from '../lib/hitl';
import type { RunStage, DomainChoice } from '@daio/shared';

interface DomainPickerProps {
  runId: string;
  stage: RunStage;
  onApproved?: () => void;
}

export function DomainPicker({ runId, stage, onApproved }: DomainPickerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const ctx = stage.output_context as Record<string, unknown> | null;
  const candidates = (ctx?.candidates ?? []) as DomainChoice[];

  async function handleConfirm() {
    if (selected === null) return;
    setPurchasing(true);
    try {
      await approveStage(runId, 'branding', candidates[selected]);
      onApproved?.();
    } catch (err) {
      console.error('Failed to approve branding:', err);
    }
    setPurchasing(false);
  }

  async function handleRetry() {
    setRejecting(true);
    try {
      await rejectStage(runId, 'branding', 'retry');
    } catch (err) {
      console.error('Failed to retry branding:', err);
    }
    setRejecting(false);
  }

  async function handleCancel() {
    setRejecting(true);
    try {
      await rejectStage(runId, 'branding', 'cancel');
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
    setRejecting(false);
    setShowConfirm(false);
  }

  if (candidates.length === 0) {
    return (
      <div className="bg-terminal-red/5 border border-terminal-red/30 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-terminal-red" />
          <span className="text-sm font-bold text-terminal-red tracking-wider uppercase">
            No Domain Candidates
          </span>
        </div>
        <p className="text-xs text-zinc-400 mb-3">
          The branding agent could not find any available domains. Try re-running the stage or cancel.
        </p>
        <div className="flex gap-2">
          <AdminGate>
            <button
              onClick={handleRetry}
              disabled={rejecting}
              className="text-terminal-amber border border-terminal-amber/30 rounded px-3 py-1.5 text-xs tracking-wider hover:bg-terminal-amber/10 transition disabled:opacity-50"
            >
              {rejecting ? 'RETRYING...' : 'RE-RUN BRANDING'}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={rejecting}
              className="text-terminal-red border border-terminal-red/30 rounded px-3 py-1.5 text-xs tracking-wider hover:bg-terminal-red/10 transition disabled:opacity-50"
            >
              CANCEL RUN
            </button>
          </AdminGate>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-terminal-cyan/5 border border-terminal-cyan/30 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-terminal-cyan animate-pulse" />
        <span className="text-sm font-bold text-terminal-cyan tracking-wider uppercase">
          Choose Your Domain
        </span>
      </div>

      <p className="text-xs text-zinc-400 mb-4">
        Select a domain name for your product. The chosen domain will be purchased and configured automatically.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {candidates.map((c, i) => (
          <button
            key={c.domain}
            onClick={() => setSelected(i)}
            disabled={purchasing || rejecting}
            className={`text-left p-3 rounded-lg border transition-all ${
              selected === i
                ? 'border-terminal-green bg-terminal-green/10 ring-1 ring-terminal-green/30'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'
            } disabled:opacity-50`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-bold text-zinc-100 font-mono break-all">
                {c.domain}
              </span>
              {selected === i && (
                <span className="text-terminal-green text-[10px] ml-1 shrink-0">SELECTED</span>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Name</span>
                <span className="text-xs text-zinc-300">{c.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Price</span>
                <span className="text-xs text-terminal-green font-mono">${c.price}/yr</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">TLD</span>
                <span className="text-xs text-zinc-300">.{c.tld}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Strategy</span>
                <span className="text-xs text-terminal-cyan">{c.strategy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Score</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-terminal-green rounded-full transition-all"
                      style={{ width: `${Math.min(100, c.score)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">{c.score}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Reasoning</span>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{c.reasoning}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <AdminGate>
          <button
            onClick={handleConfirm}
            disabled={selected === null || purchasing || rejecting}
            className="bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-4 py-1.5 text-xs tracking-wider hover:bg-terminal-green/30 transition disabled:opacity-50"
          >
            {purchasing ? 'PURCHASING...' : 'CONFIRM & PURCHASE'}
          </button>

          <button
            onClick={handleRetry}
            disabled={purchasing || rejecting}
            className="text-terminal-amber border border-terminal-amber/30 rounded px-3 py-1.5 text-xs tracking-wider hover:bg-terminal-amber/10 transition disabled:opacity-50"
          >
            {rejecting ? 'RETRYING...' : 'RE-RUN'}
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
              disabled={purchasing || rejecting}
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
