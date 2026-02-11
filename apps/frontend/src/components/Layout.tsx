import { Link, useLocation, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '>' },
  { to: '/constraints', label: 'Constraints', icon: '#' },
  { to: '/hitl', label: 'HITL Gates', icon: '||' },
  { to: '/products', label: 'Products', icon: '*' },
];

export function Layout() {
  const location = useLocation();

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

        <div className="p-3 border-t border-zinc-800">
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
