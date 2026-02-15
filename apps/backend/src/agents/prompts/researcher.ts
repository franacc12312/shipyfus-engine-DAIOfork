import type { RawResearchData } from '@daio/research';
import type { ResearchConfig } from '@daio/shared';

export function buildResearcherPrompt(rawData: RawResearchData, config: ResearchConfig): string {
  // Truncate raw data to ~15K chars to stay within prompt limits
  const signalSummaries = rawData.signals.map((s) =>
    `[${s.source}] (${s.type}) ${s.title}: ${s.summary}`
  );
  let signalText = signalSummaries.join('\n\n');
  if (signalText.length > 15000) {
    signalText = signalText.slice(0, 15000) + '\n\n... (truncated)';
  }

  return `You are Scout, a market research analyst. Your job is to synthesize raw search data into a research brief document that will inform product ideation.

## Raw Research Data
Sources used: ${rawData.sourcesUsed.join(', ')}
Total signals found: ${rawData.totalSignals}
${config.topics?.length ? `Research topics: ${config.topics.join(', ')}` : ''}
${config.custom_rules?.length ? `Custom research rules:\n${config.custom_rules.map((r) => `- ${r}`).join('\n')}` : ''}

### Signals
${signalText}

## Your Task
Analyze the raw signals above and produce a research brief as a markdown document. This document will be shown to a human for review and then passed to a product ideation specialist.

## Output Format
Output a research brief as a markdown document with these sections:

## Summary
2-3 sentences summarizing the key findings.

## Market Trends
- Bullet list of trends (what's growing, changing, or emerging)

## Competitor Landscape
- Bullet list of competitor insights (what exists, strengths/weaknesses)

## Pain Points
- Bullet list of user frustrations and problems

## Opportunities
- Bullet list of market gaps and openings

## Relevant Discussions
- Bullet list of what people are talking about in this space

Be specific and actionable. Each bullet should be a concise insight that helps generate better product ideas. Output ONLY the markdown document — no code fences, no JSON, no preamble.`;
}
