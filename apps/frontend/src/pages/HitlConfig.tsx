import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchHitlConfig, updateHitlConfig } from '../lib/hitl';
import type { HitlConfig as HitlConfigType, StageInteractionMode } from '@daio/shared';

const MODE_FIELDS = [
  {
    key: 'research_mode' as const,
    legacyKey: 'gate_after_research' as const,
    label: 'After Research',
    desc: 'Controls how the handoff into ideation behaves.',
    supportsInteractive: false,
  },
  {
    key: 'ideation_mode' as const,
    legacyKey: 'gate_after_ideation' as const,
    label: 'After Ideation',
    desc: 'Interactive mode is implemented here first.',
    supportsInteractive: true,
  },
  {
    key: 'branding_mode' as const,
    legacyKey: 'gate_after_branding' as const,
    label: 'After Branding',
    desc: 'Approval available now. Interactive wiring is staged next.',
    supportsInteractive: false,
  },
  {
    key: 'planning_mode' as const,
    legacyKey: 'gate_after_planning' as const,
    label: 'After Planning',
    desc: 'Pause before development begins.',
    supportsInteractive: false,
  },
  {
    key: 'development_mode' as const,
    legacyKey: 'gate_after_development' as const,
    label: 'After Development',
    desc: 'Approval available now. Interactive revision is future work.',
    supportsInteractive: false,
  },
  {
    key: 'deployment_mode' as const,
    legacyKey: 'gate_after_deployment' as const,
    label: 'After Deployment',
    desc: 'Pause before distribution begins.',
    supportsInteractive: false,
  },
] as const;

const MODE_OPTIONS: StageInteractionMode[] = ['automatic', 'approval', 'interactive'];

function resolveMode(
  config: HitlConfigType,
  modeKey: keyof Pick<HitlConfigType, 'research_mode' | 'ideation_mode' | 'branding_mode' | 'planning_mode' | 'development_mode' | 'deployment_mode'>,
  legacyKey: keyof Pick<HitlConfigType, 'gate_after_research' | 'gate_after_ideation' | 'gate_after_branding' | 'gate_after_planning' | 'gate_after_development' | 'gate_after_deployment'>,
): StageInteractionMode {
  const configured = config[modeKey];
  if (configured === 'automatic' || configured === 'approval' || configured === 'interactive') {
    return configured;
  }

  return config[legacyKey] ? 'approval' : 'automatic';
}

export function HitlConfig() {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<HitlConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHitlConfig()
      .then(setConfig)
      .catch(() => setError('Failed to load HITL config'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const updated = await updateHitlConfig({
        enabled: config.enabled,
        research_mode: config.research_mode,
        ideation_mode: config.ideation_mode,
        branding_mode: config.branding_mode,
        planning_mode: config.planning_mode,
        development_mode: config.development_mode,
        deployment_mode: config.deployment_mode,
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save config');
    } finally {
      setSaving(false);
    }
  }

  function setMode(field: typeof MODE_FIELDS[number], mode: StageInteractionMode) {
    if (!config) return;
    setConfig({
      ...config,
      [field.key]: mode,
      [field.legacyKey]: mode !== 'automatic',
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-zinc-500 text-sm">Loading config...</div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-6">
        <div className="text-terminal-red text-sm">{error}</div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-wider text-zinc-100">HUMAN IN THE LOOP</h2>
          <p className="mt-1 text-xs text-zinc-500">Per-stage review modes for approvals and interactive revisions</p>
        </div>
        {!isAdmin && (
          <span className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-500">
            READ ONLY
          </span>
        )}
      </div>

      <div className="max-w-3xl space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-terminal-green">
                Stage Interaction System
              </h3>
              <p className="mt-1 text-[10px] text-zinc-500">
                Disable this to force every stage back to automatic mode without changing the saved per-stage settings.
              </p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              disabled={!isAdmin}
              className={`relative h-6 w-12 rounded-full transition ${
                config.enabled ? 'bg-terminal-green/30' : 'bg-zinc-700'
              } disabled:opacity-50`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${
                  config.enabled ? 'right-0.5 bg-terminal-green' : 'left-0.5 bg-zinc-400'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Stage Modes</h3>
            <p className="mt-1 text-[10px] text-zinc-500">
              `Automatic` runs through. `Approval` pauses for approve/retry/cancel. `Interactive` opens a feedback loop.
            </p>
          </div>

          <div className="space-y-3">
            {MODE_FIELDS.map((field) => {
              const mode = resolveMode(config, field.key, field.legacyKey);

              return (
                <div
                  key={field.key}
                  className={`rounded border p-3 transition ${
                    config.enabled
                      ? 'border-zinc-700 bg-zinc-900/50'
                      : 'border-zinc-800 bg-zinc-900/20 opacity-50'
                  }`}
                >
                  <div className="mb-3">
                    <div className="text-xs text-zinc-200">{field.label}</div>
                    <div className="text-[10px] text-zinc-500">{field.desc}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {MODE_OPTIONS.map((option) => {
                      const disabled = !isAdmin || !config.enabled || (option === 'interactive' && !field.supportsInteractive);
                      const active = mode === option;

                      return (
                        <button
                          key={option}
                          onClick={() => setMode(field, option)}
                          disabled={disabled}
                          className={`rounded border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
                            active
                              ? option === 'interactive'
                                ? 'border-terminal-cyan/40 bg-terminal-cyan/15 text-terminal-cyan'
                                : option === 'approval'
                                  ? 'border-terminal-amber/40 bg-terminal-amber/15 text-terminal-amber'
                                  : 'border-terminal-green/40 bg-terminal-green/15 text-terminal-green'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                          } disabled:cursor-not-allowed disabled:opacity-40`}
                        >
                          {option}
                          {option === 'interactive' && !field.supportsInteractive ? ' (Soon)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full rounded py-2 text-xs tracking-wider transition ${
              saved
                ? 'border border-terminal-green/30 bg-terminal-green/20 text-terminal-green'
                : 'border border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500'
            } disabled:opacity-50`}
          >
            {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE CONFIGURATION'}
          </button>
        )}

        {error && (
          <div className="text-terminal-red text-xs">{error}</div>
        )}
      </div>
    </div>
  );
}
