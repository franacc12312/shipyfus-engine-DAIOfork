import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchHitlConfig, updateHitlConfig } from '../lib/hitl';
import type { HitlConfig as HitlConfigType } from '@daio/shared';

const GATE_FIELDS = [
  { key: 'gate_after_ideation' as const, label: 'After Ideation', desc: 'Pause before branding begins' },
  { key: 'gate_after_branding' as const, label: 'After Branding', desc: 'Pause before planning begins' },
  { key: 'gate_after_planning' as const, label: 'After Planning', desc: 'Pause before development begins' },
  { key: 'gate_after_development' as const, label: 'After Development', desc: 'Pause before deployment begins' },
];

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
        gate_after_ideation: config.gate_after_ideation,
        gate_after_branding: config.gate_after_branding,
        gate_after_planning: config.gate_after_planning,
        gate_after_development: config.gate_after_development,
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-wider">HUMAN IN THE LOOP</h2>
          <p className="text-xs text-zinc-500 mt-1">Require manual approval between pipeline stages</p>
        </div>
        {!isAdmin && (
          <span className="text-[10px] text-zinc-500 border border-zinc-700 rounded px-2 py-1">
            READ ONLY
          </span>
        )}
      </div>

      <div className="max-w-xl space-y-4">
        {/* Master toggle */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-terminal-green tracking-wider uppercase">
                Validation Gates
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1">
                When enabled, the pipeline pauses between stages and waits for your approval
              </p>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              disabled={!isAdmin}
              className={`w-12 h-6 rounded-full relative transition ${
                config.enabled ? 'bg-terminal-green/30' : 'bg-zinc-700'
              } disabled:opacity-50`}
            >
              <div
                className={`w-5 h-5 rounded-full absolute top-0.5 transition-all ${
                  config.enabled ? 'right-0.5 bg-terminal-green' : 'left-0.5 bg-zinc-400'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Per-stage gates */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-bold text-zinc-300 tracking-wider uppercase mb-4">
            Stage Gates
          </h3>

          {/* Pipeline visualization */}
          <div className="flex items-center justify-center gap-1 mb-6 py-3">
            {['Ideation', 'Branding', 'Planning', 'Development', 'Deployment'].map((stage, i) => {
              const gateField = GATE_FIELDS[i];
              const gateActive = config.enabled && gateField && config[gateField.key];
              return (
                <div key={stage} className="flex items-center gap-1">
                  {i > 0 && (
                    <>
                      {gateActive ? (
                        <div className="w-6 h-6 rounded-full bg-terminal-amber/20 border border-terminal-amber/50 flex items-center justify-center text-[8px] text-terminal-amber">
                          ||
                        </div>
                      ) : (
                        <div className="w-6 h-px bg-zinc-700" />
                      )}
                    </>
                  )}
                  <div className={`px-2 py-1 rounded text-[9px] tracking-wider ${
                    config.enabled ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-900 text-zinc-600'
                  }`}>
                    {stage}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            {GATE_FIELDS.map((field) => (
              <div
                key={field.key}
                className={`flex items-center justify-between p-3 rounded border transition ${
                  config.enabled
                    ? 'border-zinc-700 bg-zinc-900/50'
                    : 'border-zinc-800 bg-zinc-900/20 opacity-50'
                }`}
              >
                <div>
                  <div className="text-xs text-zinc-200">{field.label}</div>
                  <div className="text-[10px] text-zinc-500">{field.desc}</div>
                </div>
                <button
                  onClick={() => setConfig({ ...config, [field.key]: !config[field.key] })}
                  disabled={!isAdmin || !config.enabled}
                  className={`w-10 h-5 rounded-full relative transition ${
                    config[field.key] ? 'bg-terminal-amber/30' : 'bg-zinc-700'
                  } disabled:opacity-50`}
                >
                  <div
                    className={`w-4 h-4 rounded-full absolute top-0.5 transition-all ${
                      config[field.key] ? 'right-0.5 bg-terminal-amber' : 'left-0.5 bg-zinc-400'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2 rounded text-xs tracking-wider transition ${
              saved
                ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500'
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
