import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import type { Run } from '@daio/shared';

type RunWithRelations = Run;

export function useRealtimeRun(runId: string | undefined) {
  const [run, setRun] = useState<RunWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRun = useCallback(async () => {
    if (!runId) return;
    try {
      const data = await api.get<RunWithRelations>(`/runs/${runId}`);
      setRun(data);
    } catch (err) {
      console.error('Failed to fetch run:', err);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    if (!runId) return;

    fetchRun();

    // Poll for updates every 3 seconds while run is active
    const interval = setInterval(() => {
      fetchRun();
    }, 3000);

    return () => clearInterval(interval);
  }, [runId, fetchRun]);

  return { run, loading, refetch: fetchRun };
}
