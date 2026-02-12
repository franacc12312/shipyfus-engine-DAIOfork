---
description: Review a PR to determine if it's ready to merge
---

Review a GitHub pull request and determine whether it should be merged.

## Input
The user provides a PR URL or number: $ARGUMENTS

## Steps

### 1. Gather PR context
- Fetch the PR details using `gh pr view` (title, description, author, base branch, files changed, CI status)
- Fetch the full diff with `gh pr diff`
- List all PR comments and review comments

### 2. Check out the branch locally
- Fetch and check out the PR branch: `gh pr checkout <number>`
- Install dependencies: `pnpm install`

### 3. Build verification
- Run `pnpm build` across all packages
- If the build fails, report the errors and stop — recommend changes

### 4. Test verification
- Run `pnpm test` across all packages
- If any tests fail, report which tests failed and stop — recommend changes
- Note any tests that were added, modified, or removed in the PR

### 5. Lint and type checking
- Run `pnpm tsc --noEmit` across packages if not covered by build
- Check for any TypeScript errors introduced by the PR

### 6. Code review
Analyze the diff for:

**Correctness**
- Logic errors, off-by-one mistakes, race conditions
- Unhandled edge cases or error paths
- Missing null/undefined checks

**Security**
- SQL injection, XSS, command injection risks
- Secrets or credentials committed
- Insecure dependencies added

**Architecture & patterns**
- Consistency with existing codebase conventions (check CLAUDE.md)
- Unnecessary complexity or over-engineering
- Dead code or unused imports introduced

**Test coverage**
- Are new features/changes covered by tests?
- Are edge cases tested?
- Do existing tests still make sense after the changes?

**Database & migrations**
- If migrations are included: are they reversible? Do they handle existing data?
- Any missing index additions for new queries?

### 7. Run the app (if feasible)
- Start the backend and frontend with `pnpm dev`
- Wait for servers to be ready
- Do a basic smoke test (hit the health endpoint, check frontend loads)
- Stop the servers

### 8. Deliver the verdict

Present findings in this format:

```
## PR Review: #<number> — <title>

### Verdict: ✅ MERGE / ⚠️ MERGE WITH NOTES / ❌ REQUEST CHANGES

### Summary
[2-3 sentence summary of what this PR does]

### Build & Tests
- Build: ✅/❌
- Tests: ✅/❌ (X passed, Y failed)
- Types: ✅/❌
- Smoke test: ✅/❌/⏭️ skipped

### Issues Found
[List any problems, ordered by severity]

### Suggestions (non-blocking)
[Optional improvements that don't block merging]

### Files Reviewed
[List of changed files with brief notes]
```

## Rules
- Always check out the actual branch and run real builds/tests — never just review the diff alone.
- If `$ARGUMENTS` is a full URL, extract the PR number from it.
- If builds or tests fail, you can stop early — no need to do the full code review on broken code.
- Be specific about issues: reference file paths and line numbers.
- Distinguish between blocking issues (❌) and suggestions (nice-to-have).
- After the review, return to the previous branch (`git checkout -`).
- Do NOT merge the PR — only give a recommendation.
- Do NOT push any changes or leave comments on the PR unless the user asks.
