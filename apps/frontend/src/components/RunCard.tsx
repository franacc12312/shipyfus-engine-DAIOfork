import { Link } from 'react-router-dom';
import type { Run } from '@daio/shared';

const STATUS_COLORS: Record<string, string> = {
  queued: 'bg-zinc-600 text-zinc-200',
  running: 'bg-terminal-green/20 text-terminal-green',
  completed: 'bg-terminal-green text-zinc-950',
  failed: 'bg-terminal-red/20 text-terminal-red',
  cancelled: 'bg-terminal-amber/20 text-terminal-amber',
};

function getElapsed(run: Run): string {
  if (!run.started_at) return '--';
  const start = new Date(run.started_at).getTime();
  const end = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function getCurrentStage(stages: any[]): string {
  const awaiting = stages?.find((s: any) => s.status === 'awaiting_approval');
  if (awaiting) return awaiting.stage;
  const running = stages?.find((s: any) => s.status === 'running');
  if (running) return running.stage;
  const lastCompleted = stages
    ?.filter((s: any) => s.status === 'completed')
    .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
  if (lastCompleted?.length) return lastCompleted[0].stage;
  return 'queued';
}

function hasAwaitingApproval(stages: any[]): boolean {
  return stages?.some((s: any) => s.status === 'awaiting_approval') || false;
}

export function RunCard({ run }: { run: Run & { run_stages?: any[] } }) {
  const currentStage = getCurrentStage(run.run_stages || []);
  const devStage = run.run_stages?.find((s: any) => s.stage === 'development');
  const awaiting = hasAwaitingApproval(run.run_stages || []);

  return (
    <Link
      to={`/runs/${run.id}`}
      className={`block bg-zinc-950 border rounded-lg p-4 hover:border-zinc-600 transition-colors ${
        awaiting ? 'border-terminal-amber/40' : 'border-zinc-800'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${STATUS_COLORS[run.status] || STATUS_COLORS.queued}`}>
            {run.status}
          </span>
          {awaiting && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-terminal-amber/20 text-terminal-amber font-bold uppercase tracking-wider animate-pulse">
              AWAITING
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600">{getElapsed(run)}</span>
      </div>

      <p className="text-sm text-zinc-300 line-clamp-2 mb-3">
        {run.idea_summary || 'Waiting for ideation...'}
      </p>

      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          Stage: <span className="text-zinc-300">{currentStage}</span>
        </span>
        {devStage?.iteration ? (
          <span>
            Iter: <span className="text-terminal-cyan">{devStage.iteration}</span>
          </span>
        ) : null}
      </div>

      <div className="text-[10px] text-zinc-600 mt-2">
        {new Date(run.created_at).toLocaleString()}
      </div>
    </Link>
  );
}
