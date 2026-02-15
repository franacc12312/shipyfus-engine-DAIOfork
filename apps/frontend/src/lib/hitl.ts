import { api } from './api';
import type { HitlConfig, DomainChoice } from '@daio/shared';

export async function fetchHitlConfig(): Promise<HitlConfig> {
  return api.get<HitlConfig>('/hitl-config');
}

export async function updateHitlConfig(config: Partial<HitlConfig>): Promise<HitlConfig> {
  return api.put<HitlConfig>('/hitl-config', config);
}

export async function approveStage(runId: string, stage: string, chosenDomain?: DomainChoice): Promise<void> {
  const body: Record<string, unknown> = {};
  if (chosenDomain) {
    body.chosen_domain = chosenDomain;
  }
  await api.post(`/runs/${runId}/stages/${stage}/approve`, body);
}

export async function rejectStage(runId: string, stage: string, action: 'retry' | 'cancel'): Promise<void> {
  await api.post(`/runs/${runId}/stages/${stage}/reject`, { action });
}
