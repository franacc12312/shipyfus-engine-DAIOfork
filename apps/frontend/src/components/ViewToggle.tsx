interface ViewToggleProps {
  mode: 'chat' | 'terminal';
  onChange: (mode: 'chat' | 'terminal') => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => onChange('chat')}
        className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider transition ${
          mode === 'chat'
            ? 'bg-zinc-800 text-terminal-green'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        Chat
      </button>
      <button
        onClick={() => onChange('terminal')}
        className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider transition ${
          mode === 'terminal'
            ? 'bg-zinc-800 text-terminal-green'
            : 'text-zinc-500 hover:text-zinc-300'
        }`}
      >
        Terminal
      </button>
    </div>
  );
}
