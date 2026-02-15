List all active Supabase branches and their worktree associations.

## Steps

1. **Read the local registry:**
   Read `.worktrees/ports.json` and collect all entries that have a `branch` field.

2. **Fetch live branch status from Supabase:**
   ```bash
   supabase branches list --project-ref yxwkvbvbugknxdrvpzlq
   ```

3. **Cross-reference and categorize:**
   Compare the registry entries against the live Supabase output. Categorize each branch as:
   - **Active** — present in both the registry and Supabase
   - **Orphaned** — present in the registry but NOT in Supabase (stale registry entry)
   - **Untracked** — present in Supabase but NOT in the registry (created outside this workflow)

4. **Display results:**
   Print a summary table with columns: Branch Name, Worktree, Status, Supabase URL, Created At.
   Below the table, show:
   - Total active branches
   - Estimated hourly cost (~$0.01/hr per active branch)
   - Any orphaned entries that should be cleaned from `ports.json`
   - Any untracked branches that may need manual deletion

## Rules
- Always use `--project-ref yxwkvbvbugknxdrvpzlq` explicitly.
- If `ports.json` doesn't exist or has no branch entries, just show the live Supabase branches (all will be "Untracked").
- If the `supabase` CLI is not installed or the command fails, fall back to showing only registry data and warn the user.
- This is a read-only operation — never create or delete branches.
