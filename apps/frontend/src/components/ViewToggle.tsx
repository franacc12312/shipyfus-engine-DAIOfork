export type ViewMode = 'chat' | 'terminal' | 'docs';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const modes: ViewMode[] = ['chat', 'terminal', 'docs'];

  return (
    <div className="flex gap-1">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-3 py-1 rounded text-[10px] uppercase tracking-wider transition ${
            mode === m
              ? 'bg-zinc-800 text-terminal-green'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
