import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '>' },
  { to: '/constraints', label: 'Constraints', icon: '#' },
  { to: '/hitl', label: 'HITL Gates', icon: '||' },
  { to: '/products', label: 'Products', icon: '*' },
  { to: '/team', label: 'Team', icon: '@' },
];

const AUTH_NAV_ITEMS = [
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

type AuthMode = 'signin' | 'signup';

export function Layout() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, user, profile, loading, signIn, signUp, signInWithGitHub, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  async function handleAuth() {
    if (!emailInput || !passwordInput || authLoading) return;
    setAuthError(null);
    setAuthLoading(true);
    try {
      const result = authMode === 'signin'
        ? await signIn(emailInput, passwordInput)
        : await signUp(emailInput, passwordInput);

      if (result.error) {
        setAuthError(result.error.message);
      } else {
        setShowLogin(false);
        setEmailInput('');
        setPasswordInput('');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGitHub() {
    setAuthError(null);
    try {
      const result = await signInWithGitHub();
      if (result.error) {
        setAuthError(result.error.message);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'GitHub login failed');
    }
  }

  function resetAuthForm() {
    setShowLogin(false);
    setEmailInput('');
    setPasswordInput('');
    setAuthError(null);
    setAuthMode('signin');
  }

  const displayName = profile?.display_name || user?.email || 'User';
  const allNavItems = isAuthenticated ? [...NAV_ITEMS, ...AUTH_NAV_ITEMS] : NAV_ITEMS;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-xl font-bold text-orange-400 tracking-wider">
            SHIPYFUS
          </h1>
          <p className="text-[10px] text-zinc-600 mt-1 tracking-widest uppercase">
            Autonomous Product Studio
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {allNavItems.map((item) => {
            const isActive =
              item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-terminal-green'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <span className="text-terminal-green opacity-60">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
              Loading...
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-terminal-green truncate max-w-[140px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-terminal-green flex-shrink-0" />
                  <span className="truncate">{displayName}</span>
                </div>
                <button
                  onClick={signOut}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 transition flex-shrink-0"
                >
                  LOGOUT
                </button>
              </div>
              {isAdmin && (
                <div className="text-[10px] text-orange-400/70 pl-3.5">ADMIN</div>
              )}
              {user?.email && user.email !== displayName && (
                <div className="text-[10px] text-zinc-600 pl-3.5 truncate">{user.email}</div>
              )}
            </div>
          ) : showLogin ? (
            <div className="space-y-2">
              {/* Mode toggle */}
              <div className="flex gap-1">
                <button
                  onClick={() => setAuthMode('signin')}
                  className={`flex-1 text-[10px] py-0.5 rounded transition ${
                    authMode === 'signin'
                      ? 'bg-zinc-800 text-terminal-green'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  SIGN IN
                </button>
                <button
                  onClick={() => setAuthMode('signup')}
                  className={`flex-1 text-[10px] py-0.5 rounded transition ${
                    authMode === 'signup'
                      ? 'bg-zinc-800 text-orange-400'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  SIGN UP
                </button>
              </div>

              <input
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Email"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
                autoFocus
                disabled={authLoading}
              />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setAuthError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAuth();
                  if (e.key === 'Escape') resetAuthForm();
                }}
                placeholder="Password"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
                disabled={authLoading}
              />

              {authError && (
                <p className="text-red-400 text-[10px]">{authError}</p>
              )}

              <div className="flex gap-1">
                <button
                  onClick={handleAuth}
                  disabled={authLoading || !emailInput || !passwordInput}
                  className="flex-1 bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-2 py-0.5 text-[10px] hover:bg-terminal-green/30 transition disabled:opacity-50"
                >
                  {authLoading
                    ? 'LOADING...'
                    : authMode === 'signin'
                      ? 'SIGN IN'
                      : 'SIGN UP'}
                </button>
                <button
                  onClick={resetAuthForm}
                  className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition"
                >
                  ESC
                </button>
              </div>

              {/* GitHub OAuth */}
              <button
                onClick={handleGitHub}
                className="w-full flex items-center justify-center gap-1.5 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-[10px] text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition"
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Continue with GitHub
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-zinc-300 transition w-full"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
              VIEWER — LOGIN
            </button>
          )}

          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green pulse-dot" />
            SYSTEM ONLINE
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-zinc-900 grid-bg overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
