---
name: new-feature
description: Start a new feature for this project. Use when the user says "start a feature", "plan X", "new feature", "begin work on", "let's build X", or picks up a Linear issue to work on. Sets up the run folder, writes a plan with the Three-Surface Rule and test approach baked in, and claims the Linear issue.
---

# Starting a New Feature

This skill creates the run folder, writes the plan, and wires everything to Linear before a single line of code is written.

## Step 0 — Identify the Linear issue

The primary Linear interface for skills is **`node tools/linear-cli.mjs`** — a small REST/GraphQL wrapper that works in any process (interactive or background) using `LINEAR_API_KEY` from `.env.local`. It does NOT depend on a Linear MCP, which is unreliable in background sessions.

If the user provided an issue ID (e.g. via `/new-feature ACM-42`), fetch it:

```bash
node tools/linear-cli.mjs get ACM-42
```

If the user didn't provide an ID, list unassigned backlog issues and ask which one to work on:

```bash
node tools/linear-cli.mjs list --team {TEAM_NAME} --state Backlog --unassigned --limit 20
```

Capture from the `get` output:
- `ISSUE_ID` — e.g. `ACM-42` (the `identifier` field)
- `ISSUE_URL` — the `url` field
- `ISSUE_TITLE` + `ISSUE_DESCRIPTION` — for the plan
- `SHORT_NAME` — 2–4 word kebab-case slug derived from the title
- `AGENT_IDENTITY` — read from `git config user.email`

## Step 0.5 — Lock the issue (claim-before-work)

**Critical for parallel agents — do this before writing any files.**

```bash
node tools/linear-cli.mjs claim ACM-42 --email "$(git config user.email)"
```

The CLI does the race-safe sequence internally: read assignee → abort if owned by another email (exit code 2) → write assignee + In Progress → re-read to verify ownership → abort again if a race was lost. Just check the exit code:

- Exit 0: claimed cleanly, proceed
- Exit 2: already claimed by another agent → abort with "ACM-42 is already assigned to <other>"
- Exit 1: any other error → abort and surface to the user

This prevents two agents from simultaneously claiming the same backlog issue.

## Step 0.6 — Check for duplicate / overlapping work in main

Before writing the plan, check that `main` doesn't already implement the feature (a parallel agent may have shipped it while you were thinking about it).

1. Extract 2–3 distinctive keywords from the issue title.
2. Grep main for each keyword.
3. If a substantial implementation already exists (>20 lines, recognizably the same feature), **stop**. Report to the user:
   > "ACM-42 appears to be covered by existing implementation in `<file:lines>`. The issue may be stale, or this PR should be a small additive enhancement rather than a from-scratch implementation. How would you like to proceed?"
4. If existing matches are tangential (just a function name collision, or a different feature reusing the term), note it in plan.md's "Affected code" section and continue.

This prevents two agents from independently implementing the same feature.

## Step 0.7 — Bootstrap backend isolation (if in an agent worktree)

If this session was dispatched from Agent View (`claude agents`), Claude has already created a worktree under `.claude/worktrees/`. The worktree shares files with main via git, but its backend, external services, and dev port still need to be isolated.

1. Detect: is the working directory under `.claude/worktrees/`?
   ```bash
   pwd | grep -q '/.claude/worktrees/'
   ```
   If no → skip the rest of this step.

2. Check if backend isolation has already been bootstrapped (idempotent):
   ```bash
   grep -q '^AGENTIC_BRANCH_SLUG=' .env.local && echo "already bootstrapped"
   ```
   If already bootstrapped → skip.

3. Run the bootstrap script with the slug:
   ```bash
   bash tools/bootstrap-worktree-backend.sh --slug "$SHORT_NAME"
   ```
   What it does depends on how you've adapted it for your stack — see `docs/08-customizing.md` in the framework repo.

4. If the script fails, surface the error to the user and stop — do not proceed with planning while the backend is unisolated.

## Step 1 — Read context

Read these before writing the plan — don't skip:

```
ai/CONTEXT.md
ai/STANDARDS.md
ai/knowledge/pitfalls/    (list and skim for relevance)
ai/knowledge/patterns/    (list and skim for relevance)
```

Scan `ai/knowledge/decisions/` for any ADR relevant to the feature area.

## Step 2 — Create the run folder

```
ai/runs/YYYY-MM-DD_ISSUE_ID_SHORT_NAME/
  plan.md       ← write this now
  worklog.md    ← leave empty, filled during work
  review.md     ← leave empty, filled after work
  compound.md   ← leave empty, filled after review
```

Today's date: use the current date from the environment.

## Step 3 — Write plan.md

Use `ai/templates/plan.md` as the base. Add these required sections.

### Required header fields

```markdown
**Linear:** ACM-42 — <url>
**Status:** Draft
```

### Scope discipline — do exactly what the issue asks, no more

**Read the issue title and description literally. Implement that and only that.**

This is the most common failure mode for parallel agents: an agent reads ACM-42 "add usage_events table" and ships ACM-42 + ACM-43 (the helper) + ACM-44 (the routes) in one PR because "Three-Surface Rule says…". That's wrong. The Three-Surface Rule applies to **user-facing capabilities**, not to schemas, types, helpers, or internal plumbing.

Concrete rules:

- If the issue title contains **"schema"**, **"table"**, **"type"**, **"interface"**, **"add fields"** → ship only the schema/type change. No helpers, no routes, no UI. The follow-on issues (which usually exist in Linear already) handle those.
- If the issue is a **"helper"**, **"action"**, **"function"**, **"library"** → ship the helper and its tests. No UI or chat tool unless the issue says so.
- If the issue is a **chat tool**, **API route**, or **UI page** — *then* apply Three-Surface to assess what other surfaces also need to be wired.
- If you find yourself thinking "while I'm here, I'll also…" — **stop**. That's a separate issue. Note it as a follow-up in the plan's "Notes for follow-on issues" section instead of implementing it.
- When in doubt about scope, check Linear: if there's already a separate issue for the thing you're tempted to add, it definitely belongs in that issue, not this one.

The result: smaller PRs, easier review, lower merge-conflict risk between parallel agents.

### Required section: Three-Surface Rule (only if this issue ADDS a user-facing capability)

A "user-facing capability" is something a user can invoke — create, list, update, delete, run, view. NOT a schema, NOT a helper, NOT a type.

If this issue does add user-facing capability, every such capability must be callable from three surfaces:

| Capability | UI | AI chat tool | CLI/HTTP route |
|---|---|---|---|
| e.g. Create schedule | `ScheduleForm` → backend `schedules.create` | `createSchedule` tool → service fn | `POST /api/schedules` |

**Rules:**
- UI surface: React component (or your frontend) + backend mutation/query/action
- AI chat surface: `tool()` entry in your chat route → service fn. The tool must be added to the chat agent so users can trigger it conversationally.
- CLI/API surface: HTTP route accepting JSON, returning JSON.

If a capability is intentionally excluded from a surface, state why explicitly. Don't silently skip it.

**If this issue adds no user-facing capability** (e.g. it's a schema or helper), state that explicitly in plan.md ("This issue is internal/schema-only; Three-Surface does not apply") and skip the table.

### Required section: Context consulted

List which pitfall and pattern files you actually read before writing this plan:

```markdown
## Context consulted
- `ai/knowledge/pitfalls/<file>.md` — why it was relevant
- `ai/knowledge/patterns/<file>.md` — why it was relevant
```

This makes the knowledge-base usage auditable. Future tooling can grep for "Context consulted" to track which pitfalls are actually being read.

### Required section: User value

Articulate the **user persona**, their **goal**, and the **observable success/failure signal** in the plan. If you can't write a one-line success signal in the user's own vantage point (not "endpoint returns 200"), the feature isn't ready to plan — escalate to the human.

The user-value walkthrough gate (run by `/ship-feature`) reads this section to know what to attest.

### Required section: Efficiency budget

For each dimension that applies (hot-path latency, DB queries per request, bundle delta, background job cost), fill in:

- The **baseline** (current value on main) — measure it now, even roughly
- The **budget** (max acceptable post-change)

If a dimension genuinely doesn't apply, write `n/a` with a one-line reason. The efficiency reviewer (run by `/ship-feature`) compares measurements against this budget. No budget → no measurement is required → no efficiency review possible.

### Required section: Test plan

Write the test plan at planning time. Specify:

**Static checks:**
- Your equivalent of `tsc --noEmit` must pass after every task

**Unit / integration tests:**
- For each new backend function: list what inputs/outputs need a test
- For each new API route: list what it should return for valid + invalid input

**Acceptance spec (Playwright):**
- Each acceptance criterion (GWT) maps to one or more Playwright test cases
- Scaffolded in Step 3.7 below — you don't write the spec yourself, you write the criteria, the Playwright Agent CLI turns them into test stubs

**User-value walkthrough:**
- The golden path the declared user persona takes
- Performed by Claude in Chrome during `/ship-feature`, not by you now

**Eval suite (if applicable):**
- Only for quality-graded surfaces (search, ranking, AI outputs)
- Lives in `ai/eval-suites/<feature>.jsonl`; format: one JSON object per line with `input`, `expected`, `rubric`

### Full plan.md checklist

Before saving the plan, verify `ai/checklists/plan.md`. All boxes must be checkable before handing off to implementation.

## Step 3.5 — Fill the Gate scope section

Decide which validation gates apply to this feature, based on the planned scope. Each gate is either `required` or `skipped` with a one-line reason.

Defaults to use unless you have a specific reason:

| Gate | Default for | Skip if |
|---|---|---|
| `acceptance` | always required | never (cannot be opted out) |
| `user-value` | any UI-touching feature | schema-only, internal helper, CLI-only utility |
| `security` | new HTTP route, new auth path, new dep | pure refactor with no surface changes |
| `efficiency` | new DB query, hot-path change, new dep | docs-only, schema-only without query path |
| `eval` | search / ranking / AI output changes | most other features (this is the rarest gate) |

Write the Gate scope section of plan.md like:

```markdown
## Gate scope

- acceptance: required
- user-value: required
- security: skipped — "schema-only change, no new attack surface"
- efficiency: required
- eval: skipped — "no quality-graded surfaces touched"
```

`/ship-feature` will re-classify based on the actual diff and flag any discrepancies (e.g., you said "no attack surface" but ended up adding `app/api/foo/route.ts`). Set the scope honestly; "skip everything" plans get audited.

## Step 3.7 — Scaffold the acceptance spec with Playwright Agent CLI

Turn the GWT acceptance criteria into a runnable Playwright spec **now**, before any code is written. This is TDD-shaped: the spec exists before the implementation, so the implementer has a concrete target.

### If Playwright Agent CLI is configured in this project

```bash
# Path: ai/runs/YYYY-MM-DD_ACM-42_name/acceptance.spec.ts
# Project-specific command — see docs/06-testing-and-ci.md for setup.
# Typical shape:

npx playwright agent author \
  --plan "ai/runs/YYYY-MM-DD_ACM-42_name/plan.md" \
  --out  "ai/runs/YYYY-MM-DD_ACM-42_name/acceptance.spec.ts" \
  --base-url "$(grep '^AGENTIC_PREVIEW_URL=' .env.local | cut -d= -f2-)"
```

The CLI reads the **Acceptance criteria** section of plan.md and produces a `.spec.ts` with one `test(...)` block per criterion. Each block:

- Has the GWT text in the test name
- Starts with `test.fixme()` or a `// TODO` comment so failing CI is expected until implementation lands
- Uses `expect()` assertions Playwright understands (`toBeVisible`, `toHaveText`, etc.)

### If Playwright Agent CLI is NOT yet configured

Hand-author a minimal stub at `ai/runs/<run>/acceptance.spec.ts` so the file exists. Each criterion gets a `test.fixme()` stub like:

```ts
import { test, expect } from '@playwright/test';

test.fixme('Given an authenticated user, when they click "New schedule", then the schedule form appears', async ({ page }) => {
  // TODO: implement after feature lands
});
```

Document in `ai/knowledge/test-patterns/` how acceptance specs are structured for this project (selectors strategy, auth setup, etc.) so the next agent doesn't re-invent it.

### Why now, not later

Authoring after implementation has two failure modes:
1. The spec drifts to match what the code does, not what the criterion says (test-after-code bias)
2. The implementer is tempted to skip the spec under deadline pressure

Authoring now means the spec is the contract, not a retrospective doc.

## Step 4 — Post plan summary to Linear

```bash
node tools/linear-cli.mjs comment ACM-42 --body "$(cat <<'EOF'
**Plan posted** — `ai/runs/YYYY-MM-DD_ACM-42_short-name/plan.md`

<one-paragraph summary>

## Three-Surface
| Capability | UI | AI chat | CLI/HTTP |
| ... |

## Open unknowns
- ...
EOF
)"
```

## Step 5 — Tell the user what's next

Output:
1. The run folder path
2. The Linear issue link
3. A one-paragraph plain-English summary of what will be built
4. Any assumptions or unknowns that need the user's input before work can start

Do not start implementing. The plan is the output of this skill. Use the `work.md` workflow to implement.
