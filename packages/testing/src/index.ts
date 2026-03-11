export type AcceptanceCriterion = {
  id: string;
  story: string;
  criterion: string;
  testFile?: string;
};

export type TestPlan = {
  criteria: AcceptanceCriterion[];
  framework: 'playwright' | 'vitest';
  template: string;
};

/**
 * Generates a prompt for the AI to create test files from PRD acceptance criteria.
 */
export function generateTestPlanPrompt(prd: any, template: string): string {
  return `You are a test engineer. Generate a comprehensive test suite based on the following PRD acceptance criteria.

## PRD
${JSON.stringify(prd, null, 2)}

## Template
${template}

## Instructions
1. **E2E Tests (Playwright):** For every user-facing acceptance criterion, write a Playwright E2E test.
   - Place tests in \`tests/e2e/\`
   - Each test file should import from \`@playwright/test\`
   - Each test must reference its acceptance criterion ID in a comment (e.g., \`// AC-1.1\`)

2. **API Tests (vitest):** For every API endpoint or backend acceptance criterion, write a vitest test.
   - Place tests in \`tests/api/\`
   - Each test must reference its acceptance criterion ID in a comment (e.g., \`// AC-2.1\`)

3. **Test Plan:** Create a \`test-plan.md\` that maps each acceptance criterion to:
   - Its test file path
   - The test name/description
   - Whether it's E2E or API

4. **Playwright Config:** Create a \`playwright.config.ts\` configured for the project.

5. **Tests should be written to FAIL initially.** The development stage will implement the code to make them pass.

## Output
Write all test files to the project's \`tests/\` directory.
Create \`playwright.config.ts\` in the project root.
Create \`test-plan.md\` in the project root.`;
}

/**
 * Generates a prompt to check which tests are currently passing.
 */
export function generateProgressCheckPrompt(testPlan: TestPlan): string {
  const criteriaList = testPlan.criteria
    .map((c) => `- ${c.id}: ${c.criterion}${c.testFile ? ` (${c.testFile})` : ''}`)
    .join('\n');

  return `Check the current test suite status for this project.

## Test Plan
- Framework: ${testPlan.framework}
- Template: ${testPlan.template}

## Acceptance Criteria
${criteriaList}

## Instructions
1. Run the full test suite (\`npx vitest run\` for API tests, \`npx playwright test\` for E2E tests)
2. For each acceptance criterion, report:
   - ✅ PASS — test exists and passes
   - ❌ FAIL — test exists but fails
   - ⚠️ MISSING — no test found for this criterion
3. Update \`thoughts/PROGRESS.md\` with the current test status
4. Calculate overall progress as a percentage of passing tests

## Output
Provide a summary table of test results and the overall pass rate.`;
}
