import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { RunCard } from '../components/RunCard';
import { AdminGate } from '../components/AdminGate';
import { STAGES } from '@daio/shared';
import type { Run, Department } from '@daio/shared';

type RunWithStages = Run & { run_stages?: any[] };

const isDev = import.meta.env.DEV;

const TOPIC_POOL = ['AI tools', 'developer productivity', 'crypto/DeFi', 'data visualization', 'browser extensions', 'automation', 'health/fitness tech', 'content creation', 'side project tools', 'API wrappers', 'open source', 'privacy tools'];

function rPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTopics(): string {
  const shuffled = [...TOPIC_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).join(', ');
}

export function Dashboard() {
  const [runs, setRuns] = useState<RunWithStages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [startFrom, setStartFrom] = useState<Department | ''>('');
  const [sourceRunId, setSourceRunId] = useState('');
  const [mockDomainPurchase, setMockDomainPurchase] = useState(true);
  const [skipDevelopment, setSkipDevelopment] = useState(false);

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
      const body: Record<string, unknown> = {};
      if (devMode) {
        if (startFrom) {
          body.startFrom = startFrom;
          if (sourceRunId) body.sourceRunId = sourceRunId;
        }
        if (mockDomainPurchase) body.mockDomainPurchase = true;
        if (skipDevelopment) body.skipDevelopment = true;
      }
      await api.post('/runs', body);
      const message = devMode && startFrom
        ? `Run started from ${startFrom}`
        : 'Run started successfully';
      setToast({ message, type: 'success' });
      await fetchRuns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start run';
      setToast({ message, type: 'error' });
      console.error('Failed to start run:', err);
    } finally {
      setStarting(false);
    }
  }

  async function shipSomething() {
    setStarting(true);
    try {
      // Auto-configure all constraints with smart defaults, then start
      const defaults: Record<string, Record<string, unknown>> = {
        research: { enabled: true, topics: randomTopics(), max_searches: 8, moat_threshold: 2, max_competition: 'any' },
        ideation: { platform: rPick(['web','web','web','extension','cli']), audience: rPick(['developer','developer','consumer','creator']), complexity: rPick(['simple','simple','trivial']), score_threshold: 13, preferred_template: 'auto', include_learnings: true, custom_rules: ['Must be completable in a single session', 'Focus on utility apps'] },
        branding: { enabled: false, max_domain_price: 0, auto_purchase: false },
        planning: { max_phases: 4, require_tests: true, max_files_per_phase: 8, template_aware: true },
        testing: { framework: 'both', require_e2e: true, require_ac_tracing: true, min_coverage: 80 },
        development: { language: 'typescript', max_files: 20, max_iterations: 15, max_budget_usd: 10, tdd_mode: true, use_progress_md: true, inject_feedback: true, inject_posthog: false, custom_rules: ['Use Tailwind for styling', 'Keep dependencies minimal'] },
        deployment: { provider: 'vercel', auto_deploy: true, preview_deploy: false, connect_domain: false },
        distribution: { enabled: true, twitter_enabled: true, reddit_enabled: true, reddit_draft_mode: true, hackernews_enabled: false, linkedin_enabled: false, auto_post_twitter: false },
      };

      // Save all constraints silently
      for (const [dept, config] of Object.entries(defaults)) {
        try {
          await api.put(`/constraints/${dept}`, { config });
        } catch { /* some departments might not exist yet */ }
      }

      // Start the run
      await api.post('/runs', {});
      setToast({ message: '🚀 Pipeline started in blackbox mode!', type: 'success' });
      await fetchRuns();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start';
      setToast({ message, type: 'error' });
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
          <div className="flex gap-2">
            <button
              onClick={shipSomething}
              disabled={starting}
              className="bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-4 py-2 text-sm hover:bg-orange-500/30 transition tracking-wider disabled:opacity-50"
            >
              {starting ? '...' : '🚀 SHIP SOMETHING'}
            </button>
            <button
              onClick={startRun}
              disabled={starting}
              className="bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-4 py-2 text-sm hover:bg-terminal-green/30 transition tracking-wider disabled:opacity-50"
            >
              {starting ? 'INITIALIZING...' : 'START RUN'}
            </button>
          </div>
        </AdminGate>
      </div>

      {/* Dev mode panel */}
      {isDev && (
        <div className="mb-4">
          <button
            onClick={() => setDevMode(!devMode)}
            className="text-[10px] text-yellow-500/70 hover:text-yellow-500 tracking-wider transition"
          >
            {devMode ? '[-] DEV MODE' : '[+] DEV MODE'}
          </button>
          {devMode && (
            <div className="mt-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-yellow-500/70 uppercase tracking-wider w-24">Start from</label>
                <select
                  value={startFrom}
                  onChange={(e) => setStartFrom(e.target.value as Department | '')}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 flex-1"
                >
                  <option value="">Normal (all stages)</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {startFrom && startFrom !== 'research' && (
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-yellow-500/70 uppercase tracking-wider w-24">Source run</label>
                  <input
                    type="text"
                    value={sourceRunId}
                    onChange={(e) => setSourceRunId(e.target.value.trim())}
                    placeholder="Paste run ID..."
                    className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 flex-1 font-mono placeholder:text-zinc-600"
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-yellow-500/70 uppercase tracking-wider w-24">Mock domain</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mockDomainPurchase}
                    onChange={(e) => setMockDomainPurchase(e.target.checked)}
                    className="accent-yellow-500"
                  />
                  <span className="text-xs text-zinc-400">Skip real Porkbun purchase</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-[10px] text-yellow-500/70 uppercase tracking-wider w-24">Skip dev</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDevelopment}
                    onChange={(e) => setSkipDevelopment(e.target.checked)}
                    className="accent-yellow-500"
                  />
                  <span className="text-xs text-zinc-400">Stub HTML instead of ralph-loop</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

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
          <p className="text-zinc-400 text-sm mb-1">No runs yet</p>
          <p className="text-zinc-600 text-xs mb-4">
            <strong className="text-orange-400">🚀 SHIP SOMETHING</strong> = blackbox mode (auto-configures everything, you just approve/reject ideas)
            <br />
            <strong className="text-terminal-green">START RUN</strong> = uses your current constraint settings
          </p>
          <AdminGate>
            <button
              onClick={shipSomething}
              disabled={starting}
              className="bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-6 py-3 text-sm hover:bg-orange-500/30 transition tracking-wider disabled:opacity-50"
            >
              🚀 SHIP SOMETHING
            </button>
          </AdminGate>
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
