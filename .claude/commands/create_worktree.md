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
8. **Ask about Supabase branch:**
   Ask the user: "Do you want a Supabase branch database for this worktree? (~$0.01/hr, provides full DB isolation)"
   - If no → skip to step 13.
9. **Create the Supabase branch:**
   ```bash
   supabase branches create <worktree-name> --project-ref yxwkvbvbugknxdrvpzlq
   ```
10. **Wait for branch to be ready:**
    Poll every 5s, timeout 120s:
    ```bash
    supabase branches get <worktree-name> --project-ref yxwkvbvbugknxdrvpzlq -o json
    ```
    Check the `status` field. Wait until it reaches `MIGRATIONS_PASSED` or `FUNCTIONS_DEPLOYED`.
    If timeout or failure → warn the user, offer fallback to main DB, skip to step 13.
11. **Fetch branch credentials and update `.env`:**
    ```bash
    supabase branches get <worktree-name> --project-ref yxwkvbvbugknxdrvpzlq -o env
    ```
    Parse the output for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL_NON_POOLING`.

    Update the worktree root `.env`:
    - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
    - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

    Update `apps/frontend/.env` in the worktree:
    - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
12. **Seed the branch and update registry:**
    Migrations are auto-applied by Supabase branching. Seed data is not — apply it:
    ```bash
    psql "$POSTGRES_URL_NON_POOLING" -f supabase/seed.sql
    ```
    If seeding fails, warn but continue (non-fatal).

    Update the worktree's entry in `.worktrees/ports.json` to include branch info:
    ```json
    "<worktree-name>": {
      "backend": <port>,
      "frontend": <port>,
      "branch": {
        "name": "<worktree-name>",
        "projectRef": "<branch-ref-from-output>",
        "supabaseUrl": "https://<branch-ref>.supabase.co",
        "createdAt": "<ISO-timestamp>"
      }
    }
    ```
13. Update the Linear issue status to "In Progress".
14. `cd` into the newly created worktree directory.
15. Confirm the worktree was created, print the path, list the `.env` files that were copied, **print the allocated ports** (backend and frontend), show branch database info if created, and note the issue is now marked as In Progress.

## Rules
- Use the branch name provided by Linear (the `gitBranchName` field) as the git branch. The worktree **directory** name is derived separately (issue identifier + brief title).
- If the worktree already exists, tell the user instead of failing, but still `cd` into it. Read its ports from the registry and print them.
- Do NOT switch the main repo's branch — worktrees are independent.
- Always `cd` into the worktree path after creation so subsequent commands run in the correct directory.
- Only copy `.env` files (not `.env.example`). Skip any that don't exist.
- Never commit `.env` files — they should already be in `.gitignore`.
- NEVER allocate ports 3001/5173 — those are permanently reserved for main.
- When allocating ports, ensure both backend and frontend ports are unique across all worktrees in the registry.
- Branch creation is optional and non-fatal — the worktree always works (falls back to main DB).
- Always use `--project-ref yxwkvbvbugknxdrvpzlq` explicitly for all Supabase branch commands.
- Never modify the main project's database during branch operations.
- If the worktree already exists and has a branch, print the branch info from the registry instead of creating a new one.
