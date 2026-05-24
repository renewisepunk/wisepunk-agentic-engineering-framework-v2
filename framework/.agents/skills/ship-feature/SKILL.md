---
name: ship-feature
description: Run after a feature is implemented. Verifies acceptance criteria, runs static checks, deploys backend preview, runs tests, writes the review, runs the compound step to update ai/ documentation, posts a summary to the Linear issue, and closes it. Use when the user says "ship it", "done implementing", "check my work", "run tests", "wrap up this feature", "close the issue", or "mark it done".
---

# Shipping a Feature

This skill is the gate between "code written" and "issue closed". It verifies the work, captures learnings, and closes the loop with Linear.

## Step 0 — Identify the active run

If the user didn't specify: find the most recently modified `ai/runs/` folder that has a `plan.md` but no completed `review.md`. Confirm with the user before proceeding.

Read:
- `ai/runs/<run>/plan.md` — acceptance criteria and test plan
- `ai/runs/<run>/worklog.md` — any deviations or decisions made during implementation

## Step 1 — Static checks

Your stack's static-check command. For Node/TypeScript:

```bash
npx tsc --noEmit
```

For Python: `mypy .` or `pyright`. For Go: `go build ./...`. For Rust: `cargo check`.

**Stop here if it fails.** Fix all errors before continuing. Red types/build are not shippable.

## Step 2 — Deploy backend (preview, NOT main)

The right command depends on which deployment this worktree targets and what your stack uses.

**Agent worktree (preview deployment)** — when `.env.local` has `AGENTIC_BRANCH_SLUG` set:

```bash
# YOUR STACK'S PREVIEW DEPLOY COMMAND HERE
# Examples:
#   Convex:   CONVEX_DEPLOY_KEY=$(grep '^CONVEX_PREVIEW_DEPLOY_KEY=' .env.local | cut -d= -f2-) \
#               npx convex deploy --preview-name "$(grep '^AGENTIC_BRANCH_SLUG=' .env.local | cut -d= -f2-)" --yes
#   Supabase: supabase db push --db-url "$DATABASE_URL"
#   Vercel:   (handled automatically by git push to branch)
```

**Main worktree (dev deployment)** — when in the main worktree:

```bash
# YOUR STACK'S DEV DEPLOY COMMAND HERE
# Examples:
#   Convex: npx convex dev --once
```

If this fails in either case, fix the errors first.

## Step 2.5 — Rebase onto current main (catch conflicts early)

Other parallel agents may have merged their PRs while you were working. Rebase your branch onto current main BEFORE opening a PR — you have full context to resolve conflicts intelligently; the human orchestrator merging your PR later does not.

```bash
git fetch origin main
git merge origin/main --no-edit
```

If conflicts appear, common categories (adapt for your stack):

1. **Codegen files** (auto-generated API types, ORM clients) — usually safe to take main's version and re-run codegen.

2. **Chat tool registry, HTTP route registry** — manual: keep both PRs' additions and main's. These are mega-files multiple agents touch; combine additively. (Long-term fix: split into per-file modules — see `docs/08-customizing.md#mega-file-split`.)

3. **Schema file** — manual: keep both PRs' tables/indexes and main's.

4. **Pre-existing lint debt in touched files** — suppress with `// eslint-disable-next-line` + a justifying comment if necessary.

After resolving, re-run static checks to verify. Commit the merge as a separate commit (`merge: resolve <files> against main`).

## Step 3 — Verify tests exist

Read the **Test plan** section from `plan.md`. For each item listed:

**Backend function tests:**
- Check the appropriate test directory has coverage for new functions
- If missing: write the test now, don't skip
- Run them

**API route tests:**
- Verify each new HTTP route with `curl` as specified in the test plan
- Document results inline

**UI smoke test:**
- Run the `ui-test` skill (if available) against the golden path identified in the test plan
- Or manually: start the dev server, walk through the flow, screenshot
- Verify: happy path completes, error states display correctly, no regressions

**Three-Surface check:**
- For each capability listed in the plan's Three-Surface table:
  - [ ] UI: component renders, form submits, data appears
  - [ ] AI chat: tool is wired, calling it in chat produces the right result
  - [ ] CLI/API: `curl` to the HTTP route returns expected JSON

## Step 4 — Write review.md

Create `ai/runs/<run>/review.md` using `ai/workflows/review.md` as the guide. Sections:

1. Summary of what changed (one paragraph)
2. Correctness — are all acceptance criteria met? List each one with pass/fail.
3. Test coverage — what's tested, what's not, and why
4. Security — new endpoints, input validation, auth checks
5. Performance — any N+1s, unbounded ops, or payload concerns
6. Findings classified as Must fix / Should fix / Consider

**If any Must fix items exist:** stop here, fix them, re-run from Step 1.

## Step 4.5 — (Optional but recommended) Independent review

If the `/independent-review` skill is installed in this project, invoke it now:

```
/independent-review
```

This spawns a fresh agent with only the diff + plan + STANDARDS — no worklog, no implementation context. It writes `ai/runs/<run>/review-independent.md`. If it raises any Must-fix items the implementer hasn't addressed, **stop** and resolve them before continuing.

## Step 5 — Compound

Run `ai/workflows/compound.md` against this run. Concretely:

1. **`ai/knowledge/pitfalls/<slug>.md`** — for each new failure mode, create a **new file** in this directory (never append to a shared file). Format: see `ai/knowledge/pitfalls/README.md`.
2. **`ai/knowledge/patterns/<slug>.md`** — for each new pattern worth reusing, create a **new file** in this directory. Same per-entry rule.
3. **`ai/STANDARDS.md`** — promote any rule that should apply to all future work.
4. **`ai/checklists/`** — add checklist items if the review caught something that wasn't checked.
5. **`ai/knowledge/decisions/`** — write an ADR if a significant architectural decision was made.

Write `ai/runs/<run>/compound.md` summarising what was captured (or explicitly "nothing new").

## Step 6 — Update the plan template if needed

If the Three-Surface Rule revealed a surface that was regularly missed or hard to plan for, update `ai/templates/plan.md` and `ai/checklists/plan.md`.

## Step 7 — Post to Linear and close

Use `node tools/linear-cli.mjs` (REST API, works in background sessions).

1. Post a comment with the shipped summary:
   ```bash
   node tools/linear-cli.mjs comment ACM-42 --body "$(cat <<'EOF'
   **Shipped** — `ai/runs/YYYY-MM-DD_ACM-42_name/`

   <one-paragraph summary>

   ## Test results
   - <criterion>: pass/fail

   ## Follow-ups
   - <Should-fix / Consider items>
   EOF
   )"
   ```

2. Close the issue:
   ```bash
   node tools/linear-cli.mjs close ACM-42
   ```

3. If there are "Should fix" findings that warrant follow-up issues, surface them to the user — manual issue creation for now (issue creation isn't yet wired into linear-cli).

## Step 8 — Commit + push

Stage and commit any uncommitted changes (documentation updates, test files, compound edits):

```bash
git add ai/runs/<run>/ ai/knowledge/ ai/STANDARDS.md ai/checklists/ ai/templates/
git commit -m "docs: compound learnings from <run-name>"
```

Then confirm with the user whether to push and open a PR (`gh pr create`).

## Step 9 — Tell the user what shipped

Output a short summary:
- What was built (one sentence per capability)
- Test results (all pass / N issues found)
- Linear issue status (closed / follow-up issues created)
- Any open items the user should know about
