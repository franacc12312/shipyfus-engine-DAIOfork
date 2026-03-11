import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api, ApiError } from '../lib/api';

interface KeyStatus {
  configured: boolean;
  testing: boolean;
}

interface KeysState {
  anthropic: KeyStatus;
  vercel: KeyStatus;
  github: KeyStatus;
}

interface KeyTestResponse {
  valid: boolean;
  error?: string;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

export function Settings() {
  const { user, profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [vercelToken, setVercelToken] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [keys, setKeys] = useState<KeysState>({
    anthropic: { configured: false, testing: false },
    vercel: { configured: false, testing: false },
    github: { configured: false, testing: false },
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setKeys({
        anthropic: { configured: profile.has_anthropic_key, testing: false },
        vercel: { configured: profile.has_vercel_token, testing: false },
        github: { configured: profile.has_github_token, testing: false },
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  async function handleSaveName() {
    setSavingName(true);
    try {
      await api.put('/settings', { display_name: displayName });
      await refreshProfile();
      showToast('Display name updated', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save';
      showToast(msg, 'error');
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveKeys() {
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (anthropicKey) body.anthropic_api_key = anthropicKey;
      if (vercelToken) body.vercel_token = vercelToken;
      if (githubToken) body.github_token = githubToken;

      if (Object.keys(body).length === 0) {
        showToast('No keys to save — enter at least one', 'error');
        setSaving(false);
        return;
      }

      await api.put('/settings/keys', body);
      await refreshProfile();
      setAnthropicKey('');
      setVercelToken('');
      setGithubToken('');
      showToast('API keys saved', 'success');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save keys';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestKey(keyType: 'anthropic' | 'vercel' | 'github') {
    setKeys((prev) => ({
      ...prev,
      [keyType]: { ...prev[keyType], testing: true },
    }));
    try {
      const result = await api.post<KeyTestResponse>('/settings/keys/test', { key_type: keyType });
      if (result.valid) {
        showToast(`${keyType} key is valid`, 'success');
      } else {
        showToast(result.error || `${keyType} key is invalid`, 'error');
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Test failed';
      showToast(msg, 'error');
    } finally {
      setKeys((prev) => ({
        ...prev,
        [keyType]: { ...prev[keyType], testing: false },
      }));
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-zinc-100 tracking-wider">SETTINGS</h2>
        <p className="text-xs text-zinc-500 mt-1">Manage your profile and API keys</p>
      </div>

      {/* Toast */}
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

      {/* Profile section */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-zinc-200 tracking-wider mb-4">PROFILE</h3>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Email
            </label>
            <input
              type="text"
              value={user?.email || ''}
              readOnly
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-4 py-2 text-xs hover:bg-terminal-green/30 transition disabled:opacity-50 tracking-wider"
              >
                {savingName ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* API Keys section */}
      <section className="bg-zinc-950 border border-zinc-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-zinc-200 tracking-wider mb-4">API KEYS</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Keys are encrypted at rest. Enter a new value to update, or leave blank to keep existing.
        </p>

        <div className="space-y-4">
          {/* Anthropic API Key */}
          <KeyInput
            label="Anthropic API Key"
            value={anthropicKey}
            onChange={setAnthropicKey}
            placeholder="sk-ant-..."
            configured={keys.anthropic.configured}
            testing={keys.anthropic.testing}
            onTest={() => handleTestKey('anthropic')}
          />

          {/* Vercel Token */}
          <KeyInput
            label="Vercel Token"
            value={vercelToken}
            onChange={setVercelToken}
            placeholder="vercel_..."
            configured={keys.vercel.configured}
            testing={keys.vercel.testing}
            onTest={() => handleTestKey('vercel')}
          />

          {/* GitHub Token */}
          <KeyInput
            label="GitHub Token"
            value={githubToken}
            onChange={setGithubToken}
            placeholder="ghp_..."
            configured={keys.github.configured}
            testing={keys.github.testing}
            onTest={() => handleTestKey('github')}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSaveKeys}
            disabled={saving || (!anthropicKey && !vercelToken && !githubToken)}
            className="bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-6 py-2 text-xs hover:bg-orange-500/30 transition disabled:opacity-50 tracking-wider"
          >
            {saving ? 'SAVING...' : 'SAVE KEYS'}
          </button>
        </div>
      </section>
    </div>
  );
}

interface KeyInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  configured: boolean;
  testing: boolean;
  onTest: () => void;
}

function KeyInput({ label, value, onChange, placeholder, configured, testing, onTest }: KeyInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</label>
        <span
          className={`text-[10px] tracking-wider ${
            configured ? 'text-terminal-green' : 'text-zinc-600'
          }`}
        >
          {configured ? '● CONFIGURED' : '○ NOT SET'}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={configured ? '••••••••' : placeholder}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-terminal-green focus:outline-none font-mono"
        />
        <button
          onClick={onTest}
          disabled={testing || !configured}
          className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-3 py-2 text-[10px] hover:bg-zinc-700 transition disabled:opacity-40 tracking-wider"
        >
          {testing ? 'TESTING...' : 'TEST'}
        </button>
      </div>
    </div>
  );
}
