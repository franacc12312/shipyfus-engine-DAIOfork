import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useRealtimeRun } from '../hooks/useRealtimeRun';
import { useRealtimeLogs } from '../hooks/useRealtimeLogs';
import { useAgents } from '../hooks/useAgents';
import { StageIndicator } from '../components/StageIndicator';
import { LogStream } from '../components/LogStream';
import { ChatStream } from '../components/ChatStream';
import { ViewToggle } from '../components/ViewToggle';
import { AdminGate } from '../components/AdminGate';
import { api } from '../lib/api';
import { STAGES } from '@daio/shared';

const STAGE_TABS = ['all', ...STAGES] as const;

export function RunDetail() {
  const { id } = useParams();
  const { run, loading: runLoading } = useRealtimeRun(id);
  const { logs, loading: logsLoading } = useRealtimeLogs(id);
  const { agentsByStage, agentsById } = useAgents();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'chat' | 'terminal'>('chat');
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);

  if (runLoading) {
    return (
      <div className="p-6">
        <div className="text-zinc-500 text-sm">Loading run...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-6">
        <div className="text-terminal-red text-sm">Run not found</div>
        <Link to="/" className="text-terminal-green text-xs mt-2 inline-block hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isRunning = run.status === 'running' || run.status === 'queued';
  const devStage = run.run_stages?.find((s) => s.stage === 'development');
  const totalCost = run.run_stages?.reduce((sum, s) => sum + (Number(s.cost_usd) || 0), 0) || 0;

  function getElapsed(): string {
    const r = run!;
    if (!r.started_at) return '--';
    const start = new Date(r.started_at).getTime();
    const end = r.completed_at ? new Date(r.completed_at).getTime() : Date.now();
    const s = Math.round((end - start) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await api.post(`/runs/${id}/cancel`);
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
    setCancelling(false);
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      await api.post(`/runs/${id}/retry`);
    } catch (err) {
      console.error('Failed to retry:', err);
    }
    setRetrying(false);
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-zinc-500 hover:text-zinc-300 text-sm">
            &larr;
          </Link>
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">RUN</h2>
          <span className="text-xs text-zinc-600 font-mono">{id?.slice(0, 8)}</span>
        </div>

        <div className="flex gap-2">
          {run.status === 'failed' && (
            <AdminGate fallback={null}>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="text-terminal-green text-xs border border-terminal-green/30 rounded px-3 py-1 hover:bg-terminal-green/10 disabled:opacity-50"
              >
                {retrying ? 'RESUMING...' : 'RETRY'}
              </button>
            </AdminGate>
          )}
          {isRunning && (
            <AdminGate
              fallback={
                <button className="text-terminal-red text-xs border border-terminal-red/30 rounded px-3 py-1 hover:bg-terminal-red/10">
                  CANCEL
                </button>
              }
            >
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="text-terminal-red text-xs border border-terminal-red/30 rounded px-3 py-1 hover:bg-terminal-red/10 disabled:opacity-50"
              >
                {cancelling ? 'CANCELLING...' : 'CANCEL'}
              </button>
            </AdminGate>
          )}
        </div>
      </div>

      {/* Stage indicator */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mb-4">
        <StageIndicator stages={run.run_stages || []} />
      </div>

      {/* Info + Logs layout */}
      <div className="grid grid-cols-4 gap-4">
        {/* Sidebar info */}
        <div className="col-span-1 space-y-3">
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2">
            <div>
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Status</div>
              <div className={`text-sm font-bold ${
                run.status === 'completed' ? 'text-terminal-green' :
                run.status === 'running' ? 'text-terminal-green' :
                run.status === 'failed' ? 'text-terminal-red' :
                run.status === 'cancelled' ? 'text-terminal-amber' :
                'text-zinc-400'
              }`}>
                {run.status.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Duration</div>
              <div className="text-sm text-zinc-300">{getElapsed()}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Cost</div>
              <div className="text-sm text-zinc-300">${totalCost.toFixed(2)}</div>
            </div>
            {devStage?.iteration ? (
              <div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Iterations</div>
                <div className="text-sm text-terminal-cyan">{devStage.iteration}</div>
              </div>
            ) : null}
            {run.error && (
              <div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Error</div>
                <div className="text-xs text-terminal-red">{run.error}</div>
              </div>
            )}
            {run.deploy_url && (
              <div>
                <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Deploy URL</div>
                <a
                  href={run.deploy_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-terminal-green hover:underline break-all"
                >
                  {run.deploy_url}
                </a>
              </div>
            )}
          </div>

          {run.idea_summary && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Idea</div>
              <div className="text-xs text-zinc-300">{run.idea_summary}</div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="col-span-3">
          {/* Tab filter + View toggle */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              {STAGE_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider transition ${
                    activeTab === tab
                      ? 'bg-zinc-800 text-terminal-green'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {logsLoading ? (
            <div className="text-zinc-500 text-sm p-4">Loading logs...</div>
          ) : viewMode === 'chat' ? (
            <ChatStream
              logs={logs}
              agents={agentsByStage}
              agentsById={agentsById}
              isRunning={isRunning}
              stageFilter={activeTab === 'all' ? null : activeTab}
            />
          ) : (
            <LogStream
              logs={logs}
              isRunning={isRunning}
              stageFilter={activeTab === 'all' ? null : activeTab}
            />
          )}
        </div>
      </div>
    </div>
  );
}
