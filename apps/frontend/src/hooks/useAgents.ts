import { useEffect, useState } from 'react';
import type { Agent } from '@daio/shared';
import { api } from '../lib/api';

interface UseAgentsResult {
  agents: Agent[];
  agentsByStage: Record<string, Agent>;
  agentsById: Record<string, Agent>;
  loading: boolean;
}

export function useAgents(): UseAgentsResult {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.get<Agent[]>('/agents')
      .then((data) => {
        if (!cancelled) {
          setAgents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch agents:', err);
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const agentsByStage: Record<string, Agent> = {};
  const agentsById: Record<string, Agent> = {};

  for (const agent of agents) {
    if (!agentsByStage[agent.stage]) {
      agentsByStage[agent.stage] = agent;
    }
    agentsById[agent.id] = agent;
  }

  return { agents, agentsByStage, agentsById, loading };
}
