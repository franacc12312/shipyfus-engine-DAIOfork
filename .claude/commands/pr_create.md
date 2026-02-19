---
description: Merge main, verify everything works, and create a PR
---

Create a pull request for the current branch — but first, pull main, resolve conflicts, and verify everything still works.

## Steps

### 1. Pre-flight checks
- Run `git status` to confirm the working tree is clean. If there are uncommitted changes, warn the user and stop.
- Identify the current branch name and the Linear issue identifier (e.g., DAI-17) from the branch name if possible.
- Run `git log main..HEAD --oneline` to see what commits will be included in the PR.

### 2. Pull and merge main
- Fetch the latest main: `git fetch origin main`
- Merge main into the current branch: `git merge origin/main`
- If there are **merge conflicts**:
  - List all conflicting files
  - Resolve each conflict by reading the file, understanding both sides, and picking the correct resolution
  - After resolving, `git add` each file and `git merge --continue`
  - If a conflict is ambiguous and you're unsure which side is correct, **stop and ask the user**
- If the merge is clean, proceed.

### 3. Install dependencies
- Run `pnpm install` in case main introduced new dependencies
- If the lockfile changed, commit it: `pnpm install && git add pnpm-lock.yaml && git commit -m "Update lockfile after merge"`

### 4. Run all tests
- Run `pnpm test` across all packages
- If any **new** test failures appear (i.e., tests that pass on main but fail on this branch), stop and fix them
- Pre-existing integration test failures (e.g., `routes.test.ts` hitting a live server) can be noted and ignored
- Report the test results

### 5. Simplify and refine code
- Use the `code-simplifier` subagent (via the Task tool with `subagent_type: "code-simplifier"`) to simplify and refine the code changed in this branch
- The agent will focus on recently modified code, improving clarity, consistency, and maintainability while preserving all functionality
- If the agent makes any changes, review the diff, then stage and commit them: `git add -A && git commit -m "refactor: simplify and refine code"`
- If no changes were made, proceed

### 6. Build verification
- Run `pnpm --filter @daio/frontend build` to verify the frontend builds cleanly
- If the build fails, fix the errors before proceeding

### 7. Run the app and verify
- Start the dev servers: `pnpm dev`
- Wait for both backend and frontend to be ready
- Hit the backend health endpoint to confirm it's running: `curl http://localhost:<port>/api/health`
- Use Chrome MCP (if available) to:
  - Navigate to the frontend URL
  - Take a screenshot of the main page
  - Navigate to any pages affected by this branch's changes and screenshot them
  - Verify the UI looks correct and functional
- If Chrome MCP is not available, do basic API smoke tests with curl instead
- Stop the dev servers when done

### 8. Create the PR
- Push the branch to origin: `git push -u origin <branch-name>`
- Analyze ALL commits in `git log main..HEAD` to write the PR description
- Create the PR using `gh pr create` with this format:

```
gh pr create --title "<short title>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points describing what this PR does>

## Changes
<List of key changes, grouped by area (backend, frontend, shared, migrations, etc.)>

## Test plan
- [ ] All existing tests pass
- [ ] New tests added for [list new test areas]
- [ ] Frontend builds cleanly
- [ ] App verified running locally

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- If a Linear issue was identified, include `Closes DAI-XX` in the summary
- Return the PR URL to the user

## Rules
- **Never force-push.** If there's a push issue, ask the user.
- **Never skip tests or builds.** If they fail, fix or ask — don't ignore.
- If the merge with main introduces significant conflicts (more than 3 files), summarize the conflicts and ask the user if they want to proceed before resolving.
- Always report what you found at each step so the user has full visibility.
- If Chrome MCP is not connected, fall back to curl-based verification — don't block the PR on it.
- Read the worktree's `.env` to determine the correct ports (PORT and FRONTEND_PORT) rather than hardcoding them.
