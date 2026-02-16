import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface DocumentViewerProps {
  runId: string;
  isRunning?: boolean;
}

interface Documents {
  plan: string | null;
  progress: string | null;
}

function DocPanel({ title, content }: { title: string; content: string | null }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 px-1">{title}</div>
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs overflow-auto p-4 text-zinc-300 whitespace-pre-wrap"
        style={{ height: '600px' }}
      >
        {content ?? (
          <span className="text-zinc-600 italic">Not available yet</span>
        )}
      </div>
    </div>
  );
}

export function DocumentViewer({ runId, isRunning }: DocumentViewerProps) {
  const [docs, setDocs] = useState<Documents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchDocs() {
      try {
        const data = await api.get<Documents>(`/runs/${runId}/documents`);
        if (!cancelled) setDocs(data);
      } catch {
        // Endpoint may not exist yet for old runs — ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDocs();

    // Poll while run is active to catch PROGRESS.md updates
    const interval = isRunning
      ? setInterval(fetchDocs, 5000)
      : undefined;

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [runId, isRunning]);

  if (loading) {
    return (
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm"
        style={{ height: '600px' }}
      >
        Loading documents...
      </div>
    );
  }

  if (!docs?.plan && !docs?.progress) {
    return (
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 text-sm"
        style={{ height: '600px' }}
      >
        Documents not available yet — planning stage hasn't completed
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <DocPanel title="PLAN.md" content={docs.plan} />
      <DocPanel title="PROGRESS.md" content={docs.progress} />
    </div>
  );
}
