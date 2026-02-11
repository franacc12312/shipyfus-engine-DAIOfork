import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RunCard } from '../components/RunCard';
import { AdminGate } from '../components/AdminGate';
import type { Run } from '@daio/shared';

type RunWithStages = Run & { run_stages?: any[] };

export function Dashboard() {
  const [runs, setRuns] = useState<RunWithStages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function fetchRuns() {
    try {
      setError(null);
      const data = await api.get<RunWithStages[]>('/runs');
      setRuns(data);
    } catch (err) {
      setError('Failed to fetch runs');
      console.error('Failed to fetch runs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function startRun() {
    setStarting(true);
    try {
      await api.post('/runs');
      setToast({ message: 'Run started successfully', type: 'success' });
      await fetchRuns();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start run';
      setToast({ message: msg, type: 'error' });
      console.error('Failed to start run:', err);
    } finally {
      setStarting(false);
    }
  }

  const stats = {
    total: runs.length,
    active: runs.filter((r) => r.status === 'running' || r.status === 'queued').length,
    completed: runs.filter((r) => r.status === 'completed').length,
    failed: runs.filter((r) => r.status === 'failed').length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">MISSION CONTROL</h2>
          <p className="text-xs text-zinc-500 mt-1">Pipeline runs and autonomous builds</p>
        </div>

        <AdminGate>
          <button
            onClick={startRun}
            disabled={starting}
            className="bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-4 py-2 text-sm hover:bg-terminal-green/30 transition tracking-wider disabled:opacity-50"
          >
            {starting ? 'INITIALIZING...' : 'START RUN'}
          </button>
        </AdminGate>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-zinc-300' },
          { label: 'Active', value: stats.active, color: 'text-terminal-green' },
          { label: 'Completed', value: stats.completed, color: 'text-terminal-cyan' },
          { label: 'Failed', value: stats.failed, color: 'text-terminal-red' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded border text-sm ${
            toast.type === 'success'
              ? 'bg-terminal-green/10 border-terminal-green/30 text-terminal-green'
              : 'bg-terminal-red/10 border-terminal-red/30 text-terminal-red'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Runs grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <span className="inline-block w-2 h-2 bg-terminal-green rounded-full animate-pulse" />
          Loading runs...
        </div>
      ) : error ? (
        <div className="bg-zinc-950 border border-terminal-red/30 rounded-lg p-6 text-center">
          <p className="text-terminal-red text-sm">{error}</p>
          <button
            onClick={fetchRuns}
            className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded px-3 py-1 transition"
          >
            RETRY
          </button>
        </div>
      ) : runs.length === 0 ? (
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-400 text-sm">No runs yet — start your first one</p>
          <p className="text-zinc-600 text-xs mt-2">
            Click START RUN to begin an autonomous build pipeline
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}
