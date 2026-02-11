import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Department } from '@daio/shared';

interface ConstraintFormProps {
  department: Department;
}

const DEPARTMENT_FIELDS: Record<string, { label: string; key: string; type: string; options?: string[] }[]> = {
  ideation: [
    { label: 'Platform', key: 'platform', type: 'select', options: ['web', 'cli', 'api', 'library'] },
    { label: 'Audience', key: 'audience', type: 'select', options: ['consumer', 'developer', 'business'] },
    { label: 'Complexity', key: 'complexity', type: 'select', options: ['trivial', 'simple', 'moderate'] },
  ],
  planning: [
    { label: 'Max Phases', key: 'max_phases', type: 'number' },
    { label: 'Require Tests', key: 'require_tests', type: 'toggle' },
    { label: 'Max Files/Phase', key: 'max_files_per_phase', type: 'number' },
  ],
  development: [
    { label: 'Framework', key: 'framework', type: 'text' },
    { label: 'Language', key: 'language', type: 'text' },
    { label: 'Max Files', key: 'max_files', type: 'number' },
    { label: 'Max Iterations', key: 'max_iterations', type: 'number' },
    { label: 'Max Budget ($)', key: 'max_budget_usd', type: 'number' },
  ],
  branding: [
    { label: 'Max Domain Price ($)', key: 'max_domain_price', type: 'number' },
    { label: 'Preferred TLDs', key: 'preferred_tlds', type: 'text' },
  ],
  deployment: [
    { label: 'Provider', key: 'provider', type: 'select', options: ['vercel'] },
    { label: 'Auto Deploy', key: 'auto_deploy', type: 'toggle' },
  ],
};

export function ConstraintForm({ department }: ConstraintFormProps) {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState<Record<string, any>>({});
  const [customRules, setCustomRules] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<{ config: Record<string, any> }>(`/constraints/${department}`).then((data) => {
      setConfig(data.config || {});
      setCustomRules((data.config?.custom_rules || []).join('\n'));
    });
  }, [department]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const rules = customRules.split('\n').map((r) => r.trim()).filter(Boolean);
      await api.put(`/constraints/${department}`, {
        config: { ...config, custom_rules: rules },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save:', err);
    }
    setSaving(false);
  }

  const fields = DEPARTMENT_FIELDS[department] || [];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-bold text-terminal-green tracking-wider uppercase mb-4">
        {department}
      </h3>

      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                disabled={!isAdmin}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
              >
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === 'toggle' ? (
              <button
                onClick={() => isAdmin && setConfig({ ...config, [field.key]: !config[field.key] })}
                disabled={!isAdmin}
                className={`w-10 h-5 rounded-full relative transition ${
                  config[field.key] ? 'bg-terminal-green/30' : 'bg-zinc-700'
                } disabled:opacity-50`}
              >
                <div
                  className={`w-4 h-4 rounded-full absolute top-0.5 transition ${
                    config[field.key] ? 'right-0.5 bg-terminal-green' : 'left-0.5 bg-zinc-400'
                  }`}
                />
              </button>
            ) : field.type === 'number' ? (
              <input
                type="number"
                value={config[field.key] ?? ''}
                onChange={(e) => setConfig({ ...config, [field.key]: Number(e.target.value) })}
                disabled={!isAdmin}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
              />
            ) : (
              <input
                type="text"
                value={config[field.key] || ''}
                onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                disabled={!isAdmin}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-50"
              />
            )}
          </div>
        ))}

        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
            Custom Rules
          </label>
          <textarea
            value={customRules}
            onChange={(e) => setCustomRules(e.target.value)}
            disabled={!isAdmin}
            rows={3}
            placeholder="One rule per line..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 disabled:opacity-50 resize-none"
          />
        </div>

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-1.5 rounded text-xs tracking-wider transition ${
              saved
                ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30'
                : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500'
            } disabled:opacity-50`}
          >
            {saved ? 'SAVED' : saving ? 'SAVING...' : 'SAVE'}
          </button>
        )}
      </div>
    </div>
  );
}
