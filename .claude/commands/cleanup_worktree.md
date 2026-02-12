Clean up a git worktree and its feature branch.

## Input
The user provides a worktree name or Linear issue identifier: $ARGUMENTS

## Steps

1. Determine the worktree to clean up:
   - If `$ARGUMENTS` is provided, use it to find the matching worktree in `.worktrees/`
   - If no argument, check if the current working directory is inside a `.worktrees/` subdirectory and use that
   - If neither, list available worktrees in `.worktrees/` and ask the user which one to clean up
2. Get the branch name associated with the worktree by running `git worktree list` and finding the matching entry.
3. Confirm with the user: show the worktree path and branch name, ask if they want to proceed.
4. If the current working directory is inside the worktree being removed, `cd` to the project root first.
5. **Deallocate ports**: Read `.worktrees/ports.json`, remove the entry for this worktree's branch name, and write the updated registry back. NEVER remove the "main" entry.
6. Remove the worktree using `git worktree remove <path> --force`.
7. Delete the feature branch using `git branch -D <branch-name>` (skip if the branch is `main` or `master`).
8. Run `git worktree prune` to clean up stale worktree references.
9. **Update Linear issue**: If a Linear issue identifier can be inferred from the branch name (e.g., `dai-XX`), ask the user if they want to mark the issue as "Done". If yes, update the issue status to "Done" using the Linear MCP tools. If no, leave the issue status unchanged.
10. Confirm the cleanup is complete and show the updated port registry.

## Rules
- NEVER delete the `main` or `master` branch.
- NEVER remove the "main" entry from `.worktrees/ports.json`.
- Always `cd` to the project root before removing a worktree if currently inside it.
- If the worktree has uncommitted changes, warn the user and ask for confirmation before proceeding.
- If the worktree directory doesn't exist but the git reference does, still clean up with `git worktree prune`. Still remove the port entry.
- After cleanup, confirm the worktree and branch are gone.
