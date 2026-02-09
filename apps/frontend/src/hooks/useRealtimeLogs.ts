import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import type { Log } from '@daio/shared';

export function useRealtimeLogs(runId: string | undefined) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const lastIdRef = useRef<number>(0);

  const fetchLogs = useCallback(async () => {
    if (!runId) return;
    try {
      const data = await api.get<Log[]>(`/runs/${runId}/logs`);
      if (data && data.length > 0) {
        setLogs(data);
        lastIdRef.current = data[data.length - 1].id;
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    fetchLogs();

    // Poll for new logs every 2 seconds
    const interval = setInterval(fetchLogs, 2000);

    return () => clearInterval(interval);
  }, [runId, fetchLogs]);

  return { logs, loading };
}
