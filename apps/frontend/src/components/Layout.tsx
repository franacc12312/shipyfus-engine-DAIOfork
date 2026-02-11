import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { verifyPassword } from '../lib/api';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '>' },
  { to: '/constraints', label: 'Constraints', icon: '#' },
  { to: '/hitl', label: 'HITL Gates', icon: '||' },
  { to: '/products', label: 'Products', icon: '*' },
];

export function Layout() {
  const location = useLocation();
  const { isAdmin, login, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginVerifying, setLoginVerifying] = useState(false);

  async function handleLogin() {
    if (!loginInput || loginVerifying) return;
    setLoginError(null);
    setLoginVerifying(true);
    const valid = await verifyPassword(loginInput);
    if (valid) {
      login(loginInput);
      setShowLogin(false);
      setLoginInput('');
    } else {
      setLoginError('Invalid password');
      setLoginInput('');
    }
    setLoginVerifying(false);
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-xl font-bold text-terminal-green glow-green tracking-wider">
            DAIO
          </h1>
          <p className="text-[10px] text-zinc-600 mt-1 tracking-widest uppercase">
            Autonomous Product Studio
          </p>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
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
          {isAdmin ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] text-terminal-green">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-green" />
                ADMIN
              </div>
              <button
                onClick={logout}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 transition"
              >
                LOGOUT
              </button>
            </div>
          ) : showLogin ? (
            <div className="space-y-2">
              <input
                type="password"
                value={loginInput}
                onChange={(e) => {
                  setLoginInput(e.target.value);
                  setLoginError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLogin();
                  if (e.key === 'Escape') {
                    setShowLogin(false);
                    setLoginInput('');
                    setLoginError(null);
                  }
                }}
                placeholder="Password"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-[11px] text-zinc-100 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
                autoFocus
                disabled={loginVerifying}
              />
              {loginError && (
                <p className="text-red-400 text-[10px]">{loginError}</p>
              )}
              <div className="flex gap-1">
                <button
                  onClick={handleLogin}
                  disabled={loginVerifying || !loginInput}
                  className="flex-1 bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-2 py-0.5 text-[10px] hover:bg-terminal-green/30 transition disabled:opacity-50"
                >
                  {loginVerifying ? 'VERIFYING...' : 'LOGIN'}
                </button>
                <button
                  onClick={() => {
                    setShowLogin(false);
                    setLoginInput('');
                    setLoginError(null);
                  }}
                  className="px-2 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition"
                >
                  ESC
                </button>
              </div>
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
