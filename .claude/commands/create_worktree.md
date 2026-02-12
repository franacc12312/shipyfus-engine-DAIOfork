Create a git worktree for the given Linear issue.

## Input
The user provides a Linear issue identifier: $ARGUMENTS

## Steps

1. Fetch the Linear issue using the identifier "$ARGUMENTS" to get the issue details and git branch name.
2. Ensure the `.worktrees/` directory exists at the project root. If not, create it.
3. Derive a worktree directory name from the issue: lowercase issue identifier + brief dash-separated description of the issue title (e.g., `dai-19-add-admin-only-controls-for-pipeline-actions`). Use this as `<worktree-name>` for the directory under `.worktrees/`.
4. Create a new git worktree at `.worktrees/<worktree-name>` based off `main`, using the git branch name from the Linear issue as the branch.
5. Copy all `.env` files from the main repo into the new worktree, preserving their relative paths:
   - Root `.env` → `.worktrees/<worktree-name>/.env`
   - `apps/frontend/.env` → `.worktrees/<worktree-name>/apps/frontend/.env`
   - Any other `.env` files found in the main repo (check with `find . -name '.env' -not -path './.worktrees/*'`)
6. **Allocate ports** for this worktree:
   a. Read `.worktrees/ports.json`. If it doesn't exist, create it with: `{ "main": { "backend": 3001, "frontend": 5173 } }`
   b. Find the lowest available backend port starting from 3001 that is not already allocated in the registry.
   c. Find the lowest available frontend port starting from 5173 that is not already allocated in the registry.
   d. Add an entry to the registry: `"<worktree-name>": { "backend": <port>, "frontend": <port> }`
   e. Write the updated registry back to `.worktrees/ports.json`.
7. **Update the worktree's `.env`** with the allocated ports:
   - Set `PORT=<allocated-backend-port>`
   - Set `FRONTEND_URL=http://localhost:<allocated-frontend-port>`
   - Set `FRONTEND_PORT=<allocated-frontend-port>`
   - Use `sed` to replace these values in `.worktrees/<worktree-name>/.env`
8. Update the Linear issue status to "In Progress".
9. `cd` into the newly created worktree directory.
10. Confirm the worktree was created, print the path, list the `.env` files that were copied, **print the allocated ports** (backend and frontend), and note the issue is now marked as In Progress.

## Rules
- Use the branch name provided by Linear (the `gitBranchName` field) as the git branch. The worktree **directory** name is derived separately (issue identifier + brief title).
- If the worktree already exists, tell the user instead of failing, but still `cd` into it. Read its ports from the registry and print them.
- Do NOT switch the main repo's branch — worktrees are independent.
- Always `cd` into the worktree path after creation so subsequent commands run in the correct directory.
- Only copy `.env` files (not `.env.example`). Skip any that don't exist.
- Never commit `.env` files — they should already be in `.gitignore`.
- NEVER allocate ports 3001/5173 — those are permanently reserved for main.
- When allocating ports, ensure both backend and frontend ports are unique across all worktrees in the registry.
