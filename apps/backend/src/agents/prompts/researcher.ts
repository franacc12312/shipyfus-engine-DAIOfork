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

Be specific and actionable. Each bullet should be a concise insight that helps generate better product ideas.

## Market Analysis (REQUIRED)
After the sections above, add this final section:

## Market Analysis
Conduct a competitive market check:
1. Search for direct competitors — tools or products that do exactly what this market gap suggests
2. Rate the competition level as ONE of: "blue_ocean" (no real competitors), "weak_competitors" (competitors exist but are weak/outdated), "crowded" (many strong competitors), "validated_demand" (competitors prove demand exists, but there's a clear angle)
3. Identify the strongest differentiation angle for a new entrant
4. Score the MOAT (1-5) using this framework:
   - 5 = Autopilot (the product sells the WORK DONE, not the tool — users pay for output, not access)
   - 4 = Strong copilot with data/workflow lock-in
   - 3 = Copilot (tool that improves the professional, but replaceable)
   - 2 = Thin integration layer with some unique logic
   - 1 = Wrapper (pretty prompt over a model — if the next Claude/GPT improves, this product dies)
5. Answer this key question: "If the next Claude/GPT model improves significantly, does this product BENEFIT or DIE?"

Format this section as a JSON block inside a \`\`\`json code fence:

\`\`\`json
{
  "marketAnalysis": {
    "competitors": [{"name": "Competitor Name", "url": "https://...", "similarity": "high|medium|low"}],
    "verdict": "blue_ocean|weak_competitors|crowded|validated_demand",
    "differentiationAngle": "What makes a new product here defensible",
    "moatScore": 3,
    "moatReasoning": "Why this score — reference the autopilot/copilot/wrapper framework"
  }
}
\`\`\`

Output the markdown sections first, then the Market Analysis JSON block at the end. No other preamble or wrapping.`;
}
