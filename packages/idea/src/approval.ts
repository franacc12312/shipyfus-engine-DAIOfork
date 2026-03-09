import type { ApprovalPolicy, ApprovalRequest } from '@daio/pipeline-core';
import type { IdeaCandidate, IdeaSelectionDecision } from './types.js';

export function buildIdeaApprovalRequest(
  candidates: IdeaCandidate[],
  policy: ApprovalPolicy,
): ApprovalRequest<IdeaSelectionDecision> {
  return {
    key: 'idea-candidate-review',
    stage: 'ideation',
    kind: 'select-one',
    subject: 'Select the idea candidate to promote into planning',
    payload: {
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        productName: candidate.prd.productName,
        productDescription: candidate.prd.productDescription,
        targetUser: candidate.prd.targetUser,
        scorecard: candidate.scorecard,
      })),
    },
    policy,
  };
}
