import type { Department, ProductPRD, StageMessage, StageMessageKind, StageMessageRole } from '@daio/shared';
import { db } from './db.js';

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function formatPrdDraft(prd: ProductPRD): string {
  const lines = [
    `# ${prd.productName}`,
    '',
    prd.productDescription,
    '',
    `Target user: ${prd.targetUser}`,
    `Problem: ${prd.problemStatement}`,
    '',
    'Core functionality:',
    formatList(prd.coreFunctionality),
    '',
    `MVP scope: ${prd.mvpScope}`,
    `Unique value: ${prd.uniqueValue}`,
  ];

  return lines.join('\n');
}

export async function listStageMessages(runId: string, stage: Department): Promise<StageMessage[]> {
  const { data, error } = await db
    .from('stage_messages')
    .select('*')
    .eq('run_id', runId)
    .eq('stage', stage)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as StageMessage[];
}

export async function appendStageMessage(params: {
  runId: string;
  stage: Department;
  role: StageMessageRole;
  content: string;
  createdBy?: string | null;
  kind?: StageMessageKind;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db
    .from('stage_messages')
    .insert({
      run_id: params.runId,
      stage: params.stage,
      role: params.role,
      kind: params.kind ?? 'message',
      content: params.content,
      metadata: params.metadata ?? {},
      created_by: params.createdBy ?? null,
    });

  if (error) {
    throw error;
  }
}
