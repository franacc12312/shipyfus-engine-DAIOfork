export interface Learning {
  id: string;
  productName: string;
  runId: string;
  category: 'build' | 'deploy' | 'distribution' | 'feedback' | 'idea';
  lesson: string;
  impact: 'positive' | 'negative' | 'neutral';
  timestamp: string;
}

export interface LearningsSummary {
  totalProducts: number;
  avgBuildTime: number;
  topTemplates: string[];
  commonFailures: string[];
  distributionInsights: string[];
}

export function formatLearningsForIdeation(learnings: Learning[]): string {
  if (learnings.length === 0) return '';

  const positives = learnings.filter(l => l.impact === 'positive').map(l => `- ${l.lesson}`);
  const negatives = learnings.filter(l => l.impact === 'negative').map(l => `- ${l.lesson}`);

  let prompt = '\n## Learnings from Previous Ships\n';
  if (positives.length > 0) {
    prompt += '### What worked:\n' + positives.slice(-5).join('\n') + '\n';
  }
  if (negatives.length > 0) {
    prompt += '### What to avoid:\n' + negatives.slice(-5).join('\n') + '\n';
  }
  return prompt;
}
