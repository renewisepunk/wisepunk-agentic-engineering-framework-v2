# 04 — Skills

Skills wrap the four-step loop into single commands. Without skills, you'd manually invoke each workflow file. With them, an agent runs the whole pipeline from `/new-feature` to `/ship-feature`.

The framework ships three skills.

---

## `/new-feature <ISSUE>`

**File:** `.agents/skills/new-feature/SKILL.md`
**Purpose:** Start a feature. Claim the Linear issue, bootstrap isolation, write the plan, post to Linear. Do **not** start coding.

### What it does, step by step

1. **Identify the Linear issue.** Reads via `node tools/linear-cli.mjs get <ISSUE>`. Extracts title, description, URL, builds a 2–4 word kebab-case slug.

2. **Claim the issue.** Runs `tools/linear-cli.mjs claim <ISSUE> --email $(git config user.email)`. Race-safe; exits if owned by another agent.

3. **Check for duplicate work in main.** Greps for distinctive keywords from the issue title; aborts if the feature already substantially exists. Prevents two parallel agents from independently re-implementing the same thing.

4. **Bootstrap backend isolation (if in an agent worktree).** If the working directory is under `.claude/worktrees/` and isolation hasn't been bootstrapped yet, runs `tools/bootstrap-worktree-backend.sh --slug <slug>`. Creates preview backend, allocates port, writes env overrides.

5. **Read context.** `ai/CONTEXT.md`, `ai/STANDARDS.md`, list `ai/knowledge/pitfalls/` and `ai/knowledge/patterns/`, scan `ai/knowledge/decisions/`.

6. **Create the run folder.** `ai/runs/YYYY-MM-DD_<ISSUE>_<slug>/` with empty `worklog.md`, `review.md`, `compound.md`.

7. **Write `plan.md`.** From `ai/templates/plan.md`. Required header: Linear ID + URL. Required sections: Three-Surface table (or explicit "schema-only" exemption), test plan, pre-mortem.

8. **Post plan summary to Linear** as a comment via `linear-cli comment`.

9. **Stop.** Output the run folder path, Linear URL, one-paragraph summary, and any unknowns that need the human's input. Implementation is the next workflow.

### Scope discipline (the most-corrected agent failure mode)

When an agent reads `ACM-42 "add usage_events table"`, the tempting next thought is "while I'm here, I'll also add the helper, the route, and the UI" — because Three-Surface says so.

That's wrong. **Three-Surface applies to user-facing capabilities, not to schemas, helpers, types, or internal plumbing.**

Concrete rules:

- Title says "schema", "table", "type", "interface", "add fields" → ship only that. No helpers, no routes, no UI.
- Issue is a "helper", "action", "function", "library" → ship the helper + tests. No UI or chat tool unless the issue says so.
- Issue is a chat tool, API route, or UI page → *then* apply Three-Surface.
- If you find yourself thinking "while I'm here, I'll also…" — **stop**. That's a separate issue. Note it as a follow-up in the plan's "Notes for follow-on issues" section.

The result: smaller PRs, easier review, fewer merge conflicts.

---

## `/ship-feature`

**File:** `.agents/skills/ship-feature/SKILL.md`
**Purpose:** Gate between "code written" and "issue closed." Verify, deploy, review, compound, post, close.

### What it does, step by step

1. **Identify the active run.** Most recently modified `ai/runs/` folder with a `plan.md` but no completed `review.md`. Confirm with user.

2. **TypeScript check.** `npx tsc --noEmit`. Stop on failure.

3. **Deploy backend** to this worktree's preview (not main). The exact command depends on your stack — the skill detects worktree vs. main and runs the right one. See the example block in the skill file.

4. **Rebase onto current main.** Catches conflicts early while the agent still has full context. Common conflicts (codegen, schema, registries) have documented resolution patterns.

5. **Verify tests exist.** For each item in the plan's test plan: check it exists, write it if missing. Run them. Three-Surface check: UI / chat / CLI all wired.

6. **Write `review.md`** following `ai/workflows/review.md`. Pass/fail against every acceptance criterion. Findings classified Must / Should / Consider. If any Must-fix items: stop, fix, re-run from step 2.

7. **(Optional) Spawn independent reviewer.** If `/independent-review` skill is enabled, spawn a fresh agent with only the diff + plan + standards. Writes `review-independent.md`. Must-fix from either review blocks close.

8. **Compound.** Run `ai/workflows/compound.md`. Write new pitfalls/patterns as separate files. Update STANDARDS / checklists / decisions if warranted. Write `compound.md` summarizing.

9. **Update plan template** if Three-Surface revealed a surface that was regularly missed.

10. **Post to Linear and close.** Comment with shipped summary + test results + follow-ups. Close the issue via `linear-cli close <ISSUE>`.

11. **Commit any uncommitted docs/compound edits.**

12. **Tell the user what shipped.**

### Why two skills, not one big workflow

The skills hide orchestration. Behind them, the four workflows (`plan`, `work`, `review`, `compound`) are still the conceptual loop — and the right thing to invoke directly for non-feature work (typo fixes, doc updates, spikes).

The skills also encode the **shape** of the work: `/new-feature` stops *before* implementation so the human can review the plan; `/ship-feature` stops *before* merging so CI and the human can be the final gate. These pauses are deliberate.

---

## `/independent-review` (recommended)

**File:** `.agents/skills/independent-review/SKILL.md`
**Purpose:** Second pair of eyes on every PR. A fresh agent that's never seen the worklog or implementer's chat.

### Why this exists

`/ship-feature` writes `review.md` against the plan the same agent wrote. That's self-grading. The implementer knows what they meant; an independent reviewer only knows what the code does.

### What it gets

- The diff (`git diff origin/main...HEAD`)
- The plan (`plan.md`)
- `ai/STANDARDS.md`
- `ai/checklists/review.md`
- Listing of `ai/knowledge/pitfalls/`

### What it does NOT get

- `worklog.md` (the implementer's narrative)
- The implementer's `review.md` (no anchoring on its conclusions)
- Conversation history from the implementation session

### Output

`ai/runs/<run>/review-independent.md` — same shape as `review.md`, classified Must / Should / Consider.

### Block-on-must-fix

`/ship-feature` halts if the independent reviewer raised a Must-fix the implementer hasn't addressed. The implementer either fixes + commits, or responds inline in `review-independent.md` arguing why it's wrong (which the human then arbitrates).

### Cost

~one extra Claude session per PR. At a few PRs/day, negligible. If you're at 30 PRs/day, gate it by PR size (skip for diffs < 50 LOC).

---

## Adding your own skills

Skills live in `.agents/skills/<name>/SKILL.md`. The format:

```markdown
---
name: <kebab-case>
description: When to use this skill. Use when the user says "X" or wants to "Y".
---

# <Title>

<What the skill does — one paragraph>

## Step 1 — <name>
<concrete steps the agent runs>
```

Claude Code matches user input against the `description` field to decide when to invoke a skill. Keep descriptions specific and trigger-word-rich.

### Skill ideas worth adding

- **`/quick-fix`** — typo/rename/dep-bump that skips the full plan template (lightweight loop for trivial changes)
- **`/verify`** — start the dev server, take a screenshot, confirm a feature renders (already shipped in Paul9; not yet in framework — PR welcome)
- **`/security-review`** — run a focused security pass before shipping (great for capabilities that touch auth / payments)
- **`/code-review`** — run on someone else's PR; produces a structured review

---

## Next

- **How compounding actually works:** [05-knowledge-compounding.md](./05-knowledge-compounding.md)
- **CI and merge gates:** [06-testing-and-ci.md](./06-testing-and-ci.md)
