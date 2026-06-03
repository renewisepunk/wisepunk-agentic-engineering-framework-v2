---
name: independent-review
description: Spawn an independent reviewer agent that re-reviews the current branch with no implementer context. Use after the implementing agent has written its own review.md, or as part of the /ship-feature flow. Catches the class of bugs that single-agent self-review systematically misses.
---

# Independent Review

The implementing agent reviews its own work in `/ship-feature`. That's checking your own homework. This skill spawns a second agent that re-reviews the diff with no implementer context — no worklog, no implementation chat — and produces a second review.

## When to use

- After `/ship-feature` Step 4 has written `review.md` but before Step 5 (compound) and Step 7 (close).
- On any PR where you want a second pair of eyes before merging.
- As a standalone audit on a recently-shipped change.

## What the reviewer gets

- `git diff origin/main...HEAD` — the actual changes
- `ai/runs/<run>/plan.md` — what was supposed to be built
- `ai/STANDARDS.md` — rules to enforce
- `ai/checklists/review.md` — the categorical checks
- `ai/knowledge/pitfalls/` — listing (so it can grep for relevant ones)

## What the reviewer does NOT get

- `worklog.md` — would anchor it to the implementer's narrative
- `review.md` (the implementer's) — would anchor it to the implementer's conclusions
- Conversation history from the implementing session
- Any context about why decisions were made

This isolation is the whole point. The reviewer reads only what a fresh code reviewer would read.

## Step 1 — Gather inputs

```bash
RUN_DIR=$(ls -dt ai/runs/*/  | head -1)   # or use the path the user gave you
DIFF=$(git diff origin/main...HEAD)
PLAN=$(cat "$RUN_DIR/plan.md")
STANDARDS=$(cat ai/STANDARDS.md)
CHECKLIST=$(cat ai/checklists/review.md)
PITFALLS=$(ls ai/knowledge/pitfalls/)
```

## Step 2 — Spawn the reviewer

Use the Task tool to spawn a fresh agent. The prompt must be self-contained — the spawned agent has zero context.

```
Agent({
  description: "Independent code review",
  subagent_type: "general-purpose",
  prompt: `
You are an independent code reviewer. You have NEVER seen this code before.
Do not assume the implementer was right about anything.

## Plan (what was supposed to be built)
${PLAN}

## Diff (what actually got built)
\`\`\`diff
${DIFF}
\`\`\`

## Standards (rules to enforce)
${STANDARDS}

## Checklist (categorical checks)
${CHECKLIST}

## Pitfalls available
${PITFALLS}

## Your task

Produce a review against the standards and checklist. For each finding, classify as:
- **Must fix** — blocks merge
- **Should fix** — fix before next release
- **Consider** — nice-to-have

Specifically check:
- Does the code do what the plan says? Every acceptance criterion?
- Are edge cases handled?
- Are error paths covered, not just happy paths?
- Are inputs validated at boundaries?
- Are there N+1 patterns or unbounded operations?
- Three-Surface Rule: is every user-facing capability wired through UI + chat + HTTP?
- Are pitfalls in ai/knowledge/pitfalls/ that match this code area being avoided?

Write your review as a markdown document with sections:
1. Summary (one paragraph)
2. Correctness
3. Tests
4. Security
5. Performance
6. Maintainability
7. Findings (Must / Should / Consider)

Write under 800 words. Be specific (cite file:line). Do not hedge — if something's wrong, say so.
`
})
```

## Step 3 — Save the review

Write the spawned agent's output to:

```
ai/runs/<run>/review-independent.md
```

## Step 4 — Check Must-fix items

If `review-independent.md` raises any Must-fix items:

- Print them prominently to the user.
- Halt the `/ship-feature` flow.
- Wait for the implementer to either:
  - Fix the issue and commit (then re-run `/ship-feature`)
  - Respond inline in `review-independent.md` arguing why the finding is wrong (the human arbitrates)

## Step 5 — Tell the user

Summarize:
- N Must-fix, N Should-fix, N Consider findings
- Link to `review-independent.md`
- Next step: either fix or proceed

## Cost note

This adds ~one extra Claude session per PR. At a few PRs/day, negligible. At 30 PRs/day, consider gating by diff size:

```bash
LINES_CHANGED=$(git diff origin/main...HEAD --shortstat | grep -oE '[0-9]+ insertions' | grep -oE '[0-9]+')
if [ "$LINES_CHANGED" -lt 50 ]; then
  echo "Skipping independent review for diff < 50 LOC"
  exit 0
fi
```
