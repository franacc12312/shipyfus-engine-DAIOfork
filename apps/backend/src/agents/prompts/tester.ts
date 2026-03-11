export function buildTesterPrompt(prd: any, plan: string, template: string): string {
  return `Generate a test suite for this product based on the PRD acceptance criteria.

## Product PRD
${JSON.stringify(prd, null, 2)}

## Implementation Plan
${plan}

## Template
${template}

## Requirements
- Generate Playwright E2E tests for user-facing acceptance criteria
- Generate vitest tests for API endpoints
- Each test must reference its acceptance criterion ID (e.g., // AC-1.1)
- Create a playwright.config.ts configured for the project
- Create a test-plan.md mapping each AC to its test file and test name
- Tests should be written to FAIL initially (the development stage will make them pass)

## Output
Write the test files to the project's tests/ directory.
Create the playwright.config.ts in the project root.
Create test-plan.md in the project root.`;
}
