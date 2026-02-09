import type { DevelopmentConfig } from '@daio/shared';

export function buildDeveloperPrompt(config: DevelopmentConfig): string {
  return `Read and execute the plan at thoughts/PLAN.md. Follow the execution instructions exactly.

## Development Constraints
- Language: ${config.language}
- Framework: ${config.framework}
- Maximum files: ${config.max_files}
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}

## Instructions
1. Read thoughts/PROGRESS.md to see where you left off
2. Read thoughts/PLAN.md to see the full plan
3. Find the next unchecked task and implement it
4. After completing each task, mark it [x] in PLAN.md and update PROGRESS.md
5. Run tests after each phase to verify your work
6. When ALL completion criteria in PLAN.md are met, output: <promise>PRODUCT COMPLETE</promise>

CRITICAL: Only output <promise>PRODUCT COMPLETE</promise> when the project is GENUINELY complete with all tasks done and all tests passing.`;
}
