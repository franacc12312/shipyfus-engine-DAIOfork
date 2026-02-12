import { useEffect, useState } from 'react';
import type { Participant } from '@daio/shared';
import { api } from '../lib/api';

interface UseParticipantsResult {
  participants: Participant[];
  loading: boolean;
}

export function useParticipants(): UseParticipantsResult {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.get<Participant[]>('/participants')
      .then((data) => {
        if (!cancelled) {
          setParticipants(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch participants:', err);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { participants, loading };
}
