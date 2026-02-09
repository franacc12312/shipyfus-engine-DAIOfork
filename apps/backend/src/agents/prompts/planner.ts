import type { PlanningConfig, ProductPRD } from '@daio/shared';

export function buildPlannerPrompt(prd: ProductPRD, config: PlanningConfig): string {
  return `You are an AI software architect. Convert this product requirement document (PRD) into a structured execution plan.

## Product PRD
\`\`\`json
${JSON.stringify(prd, null, 2)}
\`\`\`

## Planning Constraints
- Maximum phases: ${config.max_phases}
- Require tests per phase: ${config.require_tests}
- Maximum files per phase: ${config.max_files_per_phase}
${config.custom_rules?.length ? `- Custom rules:\n${config.custom_rules.map((r) => `  - ${r}`).join('\n')}` : ''}

## Instructions

Create two files:

### 1. \`thoughts/PLAN.md\`
Structure it exactly like this:

\`\`\`markdown
# Project: ${prd.productName}

---

## Execution Instructions

**Progress Tracking:**
- Use \`thoughts/PROGRESS.md\` as your scratchpad and progress tracker
- Before starting, read PROGRESS.md to see current status and resume from where you left off
- Update PROGRESS.md as you work: current phase, notes, blockers, decisions made
- Mark checkboxes \`[x]\` in this file as you complete each task

**Workflow:**
1. Read PROGRESS.md to understand current state
2. Work through phases sequentially
3. For each task: do the work → verify → mark checkbox \`[x]\` → update PROGRESS.md
4. Complete all verification steps before moving to next phase
5. When all phases complete and verified, output: \`<promise>PRODUCT COMPLETE</promise>\`

**If interrupted:** Read both files on restart to resume seamlessly.

---

## Overview
[Brief description based on PRD]

## Tech Stack
[Based on PRD suggestedTechStack]

---

## Phase 1: [Name]
**Goal**: [What this phase accomplishes]

### Tasks
- [ ] Task 1
- [ ] Task 2
...

### Tests (REQUIRED)
- [ ] Write tests for [feature] — N+ tests covering [scenarios]

### Verification
- [ ] All tests pass
- [ ] [Specific verification]

---

[Continue with ${config.max_phases} phases max]

---

## Completion Criteria
- [ ] All tasks checked off
- [ ] All tests pass
- [ ] [Product-specific criteria from PRD successCriteria]

When all criteria are met, output: <promise>PRODUCT COMPLETE</promise>
\`\`\`

### 2. \`thoughts/PROGRESS.md\`
Create an empty progress tracker:
\`\`\`markdown
# Progress Tracker

## Current Status
- **Phase**: Not started
- **Task**: None
- **Status**: Ready to begin

---

## Completed Phases
_(Mark phases as complete here)_

---

## Current Phase Notes
_(Use this section for notes while working on the current phase)_

---

## Blockers / Issues
_(Document any blockers or issues encountered)_

---

## Decisions Made
_(Record important decisions and their reasoning)_

---

## Next Actions
_(What needs to happen next)_
\`\`\`

## Output Format
After creating the files, output a JSON block:

\`\`\`json
{
  "planFilePath": "thoughts/PLAN.md",
  "progressFilePath": "thoughts/PROGRESS.md",
  "phases": ["Phase 1 name", "Phase 2 name", ...],
  "totalTasks": <number of total tasks across all phases>
}
\`\`\``;
}
