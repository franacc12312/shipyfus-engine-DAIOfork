import type { IdeationConfig, ProductPRD } from '@daio/shared';

function buildRevisionSection(previousPrd?: ProductPRD, feedback: string[] = []): string {
  if (!previousPrd) {
    return '';
  }

  const feedbackLines = feedback.length > 0
    ? feedback.map((item) => `- ${item}`).join('\n')
    : '- No additional feedback. Refine only if the current draft is weak.';

  return `
## Current Draft
\`\`\`json
${JSON.stringify(previousPrd, null, 2)}
\`\`\`

## Human Feedback
${feedbackLines}

Revise the existing draft. Keep the core idea unless the feedback clearly asks for a larger change. Return a full replacement PRD, not a patch.
`;
}

export function buildIdeatorPrompt(
  config: IdeationConfig,
  researchMarkdown?: string,
  revision?: { previousPrd?: ProductPRD; feedback?: string[] },
): string {
  const researchSection = researchMarkdown ? `
## Market Research (from Scout)
${researchMarkdown}

Use this research to generate an idea that addresses REAL problems and fills ACTUAL market gaps. Don't just generate from training data — leverage these findings.
` : '';
  const revisionSection = buildRevisionSection(revision?.previousPrd, revision?.feedback);

  return `You are an AI product ideation specialist. Generate ONE innovative software product idea.
${researchSection}
${revisionSection}
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
  "workingTitle": "Working name for the product (a brand specialist will finalize the name later)",
  "productName": "Same as workingTitle for now",
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

Don't spend time on the perfect name — a brand specialist will finalize it. Just provide a working title that captures the essence of the product.

Be creative but practical. The idea should be interesting enough to demonstrate but simple enough to build in one session.`;
}
