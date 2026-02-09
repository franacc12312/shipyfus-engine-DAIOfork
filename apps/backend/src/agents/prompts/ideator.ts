import type { IdeationConfig } from '@daio/shared';

export function buildIdeatorPrompt(config: IdeationConfig): string {
  return `You are an AI product ideation specialist. Generate ONE innovative software product idea.

## Constraints
- Platform: ${config.platform}
- Target audience: ${config.audience}
- Complexity level: ${config.complexity}
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}

## Requirements
- The product must be buildable in a single development session by an AI coding agent
- It must be self-contained with NO external API keys or paid services required
- It must be visually demonstrable (has a UI that shows it works)
- It must solve a real problem or provide genuine utility
- Keep the scope realistic for a single-session build

## Output Format
Output your idea as a single JSON block inside a \`\`\`json code fence. Use this exact structure:

\`\`\`json
{
  "productName": "Name of the product",
  "productDescription": "2-3 sentence description of what it does",
  "targetUser": "Who would use this",
  "problemStatement": "What problem it solves",
  "coreFunctionality": ["Feature 1", "Feature 2", "Feature 3"],
  "technicalRequirements": "Technical approach summary",
  "suggestedTechStack": { "framework": "React", "language": "TypeScript", "keyDependencies": ["vite"] },
  "mvpScope": "What the minimum viable version includes",
  "successCriteria": ["Criterion 1", "Criterion 2"],
  "uniqueValue": "What makes this different or interesting"
}
\`\`\`

Be creative but practical. The idea should be interesting enough to demonstrate but simple enough to build in one session.`;
}
