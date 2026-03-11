import type { DevelopmentConfig } from '@daio/shared';
import type { Template } from '@daio/templates';

export function buildDeveloperPrompt(config: DevelopmentConfig, template?: Template): string {
  const analyticsHint = config.analytics?.enabled !== false && config.analytics?.provider !== 'none'
    ? `\n- Analytics: PostHog is pre-configured via snippet injection. If posthog-js is in the plan, initialize it in the root component.`
    : '';

  const templateHint = template
    ? `\n## Template\nThis project is based on the ${template.name} template from repo ${template.repo} (${template.description}). The template has been cloned and customized with the project name. Build on top of the existing template code — do not start from scratch.\n`
    : '';

  return `Read and execute the plan at thoughts/PLAN.md. Follow the execution instructions exactly.
${templateHint}

## Development Constraints
- Language: ${config.language}
- Framework: ${config.framework}
- Maximum files: ${config.max_files}
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}${analyticsHint}

## TDD Mode
This project uses TDD. Test files already exist in tests/. Your goal is to make ALL tests pass.
After each iteration, run the test suite and report which tests pass and which fail.
Continue iterating until all tests pass.
Check thoughts/PROGRESS.md for current test status. Update it after each iteration with passing/failing tests.

## Instructions
1. Read thoughts/PROGRESS.md to see where you left off and current test status
2. Read thoughts/PLAN.md to see the full plan
3. Run the existing test suite to see what's failing
4. Find the next unchecked task and implement it, focusing on making tests pass
5. After completing each task, mark it [x] in PLAN.md and update PROGRESS.md with test results
6. Run tests after each phase to verify your work
7. When ALL completion criteria in PLAN.md are met and ALL tests pass, output: <promise>PRODUCT COMPLETE</promise>

CRITICAL: Only output <promise>PRODUCT COMPLETE</promise> when the project is GENUINELY complete with all tasks done and all tests passing.`;
}
