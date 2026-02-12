---
description: Pick the best Linear issue to work on next
---

Analyze the DAIO Linear backlog and recommend the best issue to work on next.

## Steps

1. **Fetch current work in progress**: List all Linear issues for team "DAIO" that are in the "In Progress" or "In Review" state. Note which files/areas they likely touch.

2. **Fetch the backlog**: List all Linear issues for team "DAIO" in "Backlog" or "Todo" state. For each issue, fetch its full details (description, labels, priority, etc.).

3. **Analyze and rank** each backlog issue using the following criteria (in order of importance):

   ### Scoring Criteria

   **a. Bugs first (+3 points)**
   Issues labeled "Bug" get highest priority — broken things should be fixed before building new things.

   **b. Priority level**
   - Urgent: +4 points
   - High: +3 points
   - Medium: +2 points
   - Low: +1 point
   - None: +0 points

   **c. Merge conflict risk (-1 to -3 points)**
   Compare each candidate issue against the in-progress work. If they likely touch the same files or areas (e.g., both modify `frontend/components`, both touch the same API routes), penalize the candidate. The more overlap, the higher the penalty.

   **d. Dependency awareness (+1 point)**
   If an issue unblocks other issues or is a prerequisite for higher-impact work, boost it.

   **e. Effort vs Impact**
   Smaller issues that deliver meaningful value should rank above large speculative features.

4. **Present a ranked recommendation** to the user in this format:

   ```
   ## Issue Recommendations

   ### 🥇 Recommended: DAI-XX — Title
   **Priority**: High | **Labels**: Bug | **Score**: X
   **Why**: [1-2 sentence explanation of why this is the best pick]
   **Merge conflict risk**: Low/Medium/High (based on in-progress work)

   ### 🥈 Runner-up: DAI-XX — Title
   **Priority**: Medium | **Labels**: Feature | **Score**: X
   **Why**: [explanation]

   ### 🥉 Also consider: DAI-XX — Title
   **Priority**: Medium | **Labels**: Improvement | **Score**: X
   **Why**: [explanation]

   ---

   ### Currently In Progress
   - DAI-XX — Title (assigned to: name)
   - DAI-XX — Title (assigned to: name)
   ```

5. **Ask the user** which issue they'd like to pick up. Once they confirm, run `/create_workspace` with the chosen issue identifier.

## Rules
- Only consider issues in "Backlog" or "Todo" state — never pick issues already in progress, in review, done, canceled, or duplicate.
- Always show what's currently in progress so the user has full context.
- If the backlog is empty, tell the user there are no issues to pick up.
- If there's only one issue, still present it with the analysis but skip the ranking.
- Use the Linear MCP tools (list_issues, get_issue) — do not use the browser.
