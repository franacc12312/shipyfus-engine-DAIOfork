Clean up a git worktree and its feature branch.

## Input
The user provides a worktree name or Linear issue identifier: $ARGUMENTS

## Steps

1. Determine the worktree to clean up:
   - If `$ARGUMENTS` is provided, use it to find the matching worktree in `.worktrees/`
   - If no argument, check if the current working directory is inside a `.worktrees/` subdirectory and use that
   - If neither, list available worktrees in `.worktrees/` and ask the user which one to clean up
2. Get the branch name associated with the worktree by running `git worktree list` and finding the matching entry.
3. If the worktree was confidently inferred (from `$ARGUMENTS` or current directory), proceed without confirmation. Only ask the user to confirm if the match is ambiguous or uncertain.
4. If the current working directory is inside the worktree being removed, `cd` to the project root first.
5. **Deallocate ports and check for Supabase branch**: Read `.worktrees/ports.json`, check the worktree's entry for a `branch` field (save it for step 6), then remove the entry from the registry and write the updated file back. NEVER remove the "main" entry.
6. **Delete Supabase branch if it exists:** If the entry from step 5 had a `branch` field:
   ```bash
   supabase branches delete <branch-name> --project-ref yxwkvbvbugknxdrvpzlq --yes
   ```
   If deletion fails → warn the user and provide the manual command, but continue cleanup.
7. Remove the worktree using `git worktree remove <path> --force`.
8. Delete the feature branch using `git branch -D <branch-name>` (skip if the branch is `main` or `master`).
9. Run `git worktree prune` to clean up stale worktree references.
10. **Update Linear issue**: If a Linear issue identifier can be inferred from the branch name (e.g., `dai-XX`), ask the user if they want to mark the issue as "Done". If yes, update the issue status to "Done" using the Linear MCP tools. If no, leave the issue status unchanged.
11. Confirm the cleanup is complete and show the updated port registry.

## Rules
- NEVER delete the `main` or `master` branch.
- NEVER remove the "main" entry from `.worktrees/ports.json`.
- Always `cd` to the project root before removing a worktree if currently inside it.
- If the worktree has uncommitted changes, warn the user and ask for confirmation before proceeding.
- If the worktree directory doesn't exist but the git reference does, still clean up with `git worktree prune`. Still remove the port entry.
- Supabase branch deletion failure is non-fatal — always continue with worktree removal.
- Always use `--yes` to skip interactive prompts when deleting Supabase branches.
- Always use `--project-ref yxwkvbvbugknxdrvpzlq` explicitly for Supabase branch commands.
- After cleanup, confirm the worktree and branch are gone.
