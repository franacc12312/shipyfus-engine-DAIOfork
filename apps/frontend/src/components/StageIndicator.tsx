import { STAGES } from '@daio/shared';
import type { RunStage } from '@daio/shared';

const STAGE_LABELS: Record<string, string> = {
  research: 'Research',
  ideation: 'Ideation',
  branding: 'Branding',
  planning: 'Planning',
  development: 'Development',
  deployment: 'Deployment',
};

interface StageIndicatorProps {
  stages: RunStage[];
}

function getDuration(stage: RunStage): string {
  if (!stage.started_at) return '';
  const start = new Date(stage.started_at).getTime();
  const end = stage.completed_at ? new Date(stage.completed_at).getTime() : Date.now();
  const s = Math.round((end - start) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function StageIndicator({ stages }: StageIndicatorProps) {
  const stageMap = Object.fromEntries(stages.map((s) => [s.stage, s]));

  return (
    <div className="flex items-center gap-2">
      {STAGES.map((stageName, i) => {
        const stage = stageMap[stageName];
        const status = stage?.status || 'pending';

        return (
          <div key={stageName} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`w-8 h-px ${
                  status === 'completed' ? 'bg-terminal-green' :
                  status === 'running' ? 'bg-terminal-green/40' :
                  status === 'cancelled' ? 'bg-terminal-amber/40' :
                  'bg-zinc-700'
                }`}
              />
            )}

            <div className="flex flex-col items-center gap-1">
              {/* Status dot */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${
                    status === 'completed' ? 'bg-terminal-green text-zinc-950' :
                    status === 'running' ? 'bg-terminal-green/30 border border-terminal-green pulse-dot' :
                    status === 'awaiting_approval' ? 'bg-terminal-amber/30 border border-terminal-amber pulse-dot' :
                    status === 'cancelled' ? 'bg-terminal-amber/30 border border-terminal-amber' :
                    status === 'failed' ? 'bg-terminal-red/30 border border-terminal-red' :
                    status === 'skipped' ? 'bg-zinc-800 border border-zinc-700' :
                    'bg-zinc-800 border border-zinc-600'
                  }`}
                >
                  {status === 'completed' && '✓'}
                  {status === 'awaiting_approval' && '!'}
                  {status === 'cancelled' && '⊘'}
                  {status === 'failed' && '×'}
                  {status === 'skipped' && '—'}
                </div>

                <span
                  className={`text-[10px] tracking-wider ${
                    status === 'completed' ? 'text-terminal-green' :
                    status === 'running' ? 'text-terminal-green' :
                    status === 'awaiting_approval' ? 'text-terminal-amber' :
                    status === 'cancelled' ? 'text-terminal-amber' :
                    status === 'failed' ? 'text-terminal-red' :
                    status === 'skipped' ? 'text-zinc-600' :
                    'text-zinc-500'
                  }`}
                >
                  {STAGE_LABELS[stageName]}
                  {status === 'awaiting_approval' && (
                    <span className="ml-1 text-[8px] text-terminal-amber/70">AWAITING</span>
                  )}
                  {status === 'cancelled' && (
                    <span className="ml-1 text-[8px] text-terminal-amber/70">CANCELLED</span>
                  )}
                  {status === 'skipped' && (
                    <span className="ml-1 text-[8px] text-zinc-600">SKIPPED</span>
                  )}
                </span>
              </div>

              {/* Info below */}
              <div className="flex gap-2 text-[9px] text-zinc-600">
                {stageName === 'development' && stage?.iteration ? (
                  <span className="text-terminal-cyan">Iter {stage.iteration}/20</span>
                ) : null}
                {status === 'completed' && stage && (
                  <>
                    <span>{getDuration(stage)}</span>
                    {stage.cost_usd ? <span>${Number(stage.cost_usd).toFixed(2)}</span> : null}
                  </>
                )}
                {status === 'running' && stage && (
                  <span className="text-terminal-green">{getDuration(stage)}</span>
                )}
                {status === 'awaiting_approval' && stage && (
                  <span className="text-terminal-amber">{getDuration(stage)}</span>
                )}
                {status === 'cancelled' && stage && (
                  <span className="text-terminal-amber">{getDuration(stage)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
