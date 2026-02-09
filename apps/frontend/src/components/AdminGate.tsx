import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AdminGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AdminGate({ children, fallback }: AdminGateProps) {
  const { isAdmin, login } = useAuth();
  const [input, setInput] = useState('');
  const [showModal, setShowModal] = useState(false);

  if (isAdmin) return <>{children}</>;

  if (fallback && !showModal) {
    return (
      <div onClick={() => setShowModal(true)} className="cursor-pointer">
        {fallback}
      </div>
    );
  }

  return (
    <>
      {fallback && (
        <div onClick={() => setShowModal(true)} className="cursor-pointer">
          {fallback}
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-80">
            <h2 className="text-terminal-green text-sm font-bold mb-4 tracking-wider">
              ADMIN ACCESS
            </h2>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && input) {
                  login(input);
                  setShowModal(false);
                }
              }}
              placeholder="Enter admin password"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-terminal-green focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (input) {
                    login(input);
                    setShowModal(false);
                  }
                }}
                className="flex-1 bg-terminal-green/20 text-terminal-green border border-terminal-green/30 rounded px-3 py-1.5 text-sm hover:bg-terminal-green/30 transition"
              >
                Authenticate
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-3 py-1.5 text-zinc-500 text-sm hover:text-zinc-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
