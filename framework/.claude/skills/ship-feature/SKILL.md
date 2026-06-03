---
name: ship-feature
description: Run after a feature is implemented. Classifies which validation gates apply to this diff, runs only those (acceptance specs, user-value walkthrough, security review, efficiency review, eval suites), aggregates findings, writes review.md, runs compound, posts to Linear, and closes the issue. Use when the user says "ship it", "done implementing", "check my work", "run tests", "wrap up this feature", "close the issue", or "mark it done".
---

# Shipping a Feature

This skill is the gate between "code written" and "issue closed". It validates the work through targeted lenses (only the ones that apply), captures learnings, and closes the loop with Linear.

The flow is **gate-driven**: a classifier inspects the diff and the plan, decides which validation gates apply, and runs only those. A docs-only PR doesn't trigger security review. A schema-only PR doesn't trigger a user-value walkthrough. A search-feature PR triggers the eval suite. This is what keeps validation thorough without crushing velocity.

## Step 0 — Identify the active run

If the user didn't specify: find the most recently modified `ai/runs/` folder that has a `plan.md` but no completed `review.md`. Confirm with the user before proceeding.

Read:
- `ai/runs/<run>/plan.md` — acceptance criteria, user value, efficiency budget, gate scope
- `ai/runs/<run>/worklog.md` — deviations and decisions during implementation

Set:
```bash
RUN_DIR=ai/runs/<run>
```

## Step 0.5 — Classify gates

Run the deterministic classifier. It reads `ai/gates.config.mjs` + the diff + the plan's Gate scope section and writes `gates.manifest.json`.

```bash
node tools/gate-classifier.mjs --run "$RUN_DIR" --base origin/main --head HEAD
EXIT=$?
```

Print the resulting manifest to the user so they see which gates will run before any reviewer sessions burn tokens.

- Exit 0 — manifest written cleanly, proceed.
- Exit 2 — discrepancies between plan-declared scope and file-pattern triggers. Continue to Step 0.6 (semantic override).
- Exit 1 — error, fix and re-run.

## Step 0.6 — Semantic override (only if classifier exited 2)

When the plan said "skip security" but the diff touched `app/api/**/route.ts`, or the plan said "required" without a clear matching trigger, do a semantic pass. The classifier wrote the discrepancies to `gates.manifest.json` under `discrepancies`. For each:

Read the diff context around the discrepant file(s) and the plan's justification. Decide:

1. **Plan was right, globs were wrong** — e.g., the file looks like a route but is actually a no-op redirect with no logic. Document this in `gates.manifest.json` (edit the gate's `reason`), and *narrow* `ai/gates.config.mjs` triggers if this is a recurring false positive.

2. **Globs were right, plan was wrong** — the implementation deviated from the plan and added real attack surface. **Override the plan**, mark the gate `required`, edit `gates.manifest.json`, and document why in the review later.

3. **Ambiguous** — escalate to the human. Don't auto-decide.

Print the resolution for each discrepancy.

## Step 1 — Static checks (always)

```bash
npx tsc --noEmit         # or your stack: mypy . / go build ./... / cargo check
```

**Stop here if it fails.** Red types/build are not shippable.

## Step 2 — Deploy backend preview (always)

Same as before:

```bash
# Agent worktree: preview deploy using AGENTIC_BRANCH_SLUG
# Main worktree: dev deploy
# Project-specific command — see framework docs.
```

If this fails, fix and re-run from Step 1.

## Step 2.5 — Rebase onto current main

```bash
git fetch origin main
git merge origin/main --no-edit
```

Resolve conflicts; common categories: codegen (re-run), registries (additive merge), schema (additive merge), lint debt (suppress with justification). Commit the merge separately: `merge: resolve <files> against main`.

After resolving, re-run static checks.

## Step 3 — Run the gated validations

Read `$RUN_DIR/gates.manifest.json`. For each gate where `required: true`, run the gate's procedure below. **Order matters**: cheaper checks first so expensive ones (LLM reviewers) only run on builds that already pass cheaper ones.

### 3a — Acceptance gate (always required)

The acceptance spec was scaffolded by `/new-feature` at `$RUN_DIR/acceptance.spec.ts`. Now run it:

```bash
# Project-specific command. Typical shape:
npx playwright test "$RUN_DIR/acceptance.spec.ts" \
  --reporter=list,json \
  --output="$RUN_DIR/playwright-report"
```

Capture pass/fail per test. Map each test back to the matching acceptance criterion in `plan.md`. If a test still has `test.fixme()` markers, **fail the gate** — the implementer was supposed to remove those when the criterion was satisfied.

If any acceptance test fails: stop, fix, re-run from Step 1. Don't proceed to expensive gates with a broken golden path.

Write a one-paragraph result to `$RUN_DIR/acceptance-result.md`.

### 3b — Efficiency gate (if required in manifest)

Skip if `gates.efficiency.required: false`.

1. **Implementer measurements check.** Look for `$RUN_DIR/efficiency-evidence.md` or measurement snippets in `worklog.md`. If missing for any non-`n/a` row in the plan's Efficiency budget → **fail the gate** with: "Measurement missing for <dimension>. Take baseline + post-change measurements and re-run."
2. **Invoke the specialist reviewer:**
   ```
   /efficiency-review
   ```
3. Read the output at `$RUN_DIR/review-efficiency.md`. If any Must-fix: stop, address, re-run from Step 1.

### 3c — Security gate (if required in manifest)

Skip if `gates.security.required: false`.

```
/security-review
```

Read `$RUN_DIR/review-security.md`. If Must-fix: stop, address, re-run from Step 1. If the reviewer added test stubs to `acceptance.spec.ts`, re-run the acceptance gate (3a) to confirm they pass.

### 3d — User-value gate (if required in manifest)

Skip if `gates.user-value.required: false`.

This is the **only** gate that uses Claude in Chrome / agent-browser (not Playwright). The walk is judgment-based, screenshots-and-attestation, not deterministic assertion.

1. Open the preview URL in a Chrome session.
2. Walk the golden path as the user persona declared in `plan.md` ("User value" section).
3. Verify each item in `ai/checklists/user-value.md`: discoverability, first-use clarity, happy path, speed perception, error states, empty states, mobile.
4. For each Three-Surface row, test the surface and capture a screenshot of the success signal.
5. Write `$RUN_DIR/user-value.md` per the template at the bottom of `ai/checklists/user-value.md` — with screenshots, cross-surface table, and a four-question attestation.

If the attestation says "delivers value? No/Partially" → **fail the gate**. Stop, escalate.

### 3e — Eval gate (if required in manifest)

Skip if `gates.eval.required: false`.

```bash
node tools/eval-runner.mjs --ci --out "$RUN_DIR/eval-report.md"
```

The runner pre-filters with structural checks, then LLM-judges each case against the rubric. Read `$RUN_DIR/eval-report.md`. If any case regressed compared to main (or any case fails outright) → **fail the gate**. Fix the underlying quality issue or update the rubric (with justification) and re-run.

### 3f — General independent review (recommended, not a formal gate)

After all gates pass, optionally run the generalist reviewer to catch anything the specialists missed:

```
/independent-review
```

Output at `$RUN_DIR/review-independent.md`. Treat Must-fix items the same as a failing gate.

## Step 4 — Aggregate into review.md

Write `$RUN_DIR/review.md` synthesizing all the gate outputs:

```markdown
# Review — <run name>

## Summary
<one paragraph: what shipped + headline result of each gate>

## Gates run
| Gate | Status | Detail |
|---|---|---|
| acceptance | ✓ pass | 5/5 specs pass |
| efficiency | ✓ pass | within budget on all dimensions |
| security | ✓ pass | no findings |
| user-value | ✓ pass | golden path attested; mobile OK |
| eval | n/a | not triggered |

## Gates skipped + why
- security: skipped per plan ("schema-only change"); classifier confirmed
- eval: skipped per plan ("no quality-graded surfaces")

## Acceptance criteria
<each criterion from plan.md, mapped to its acceptance.spec.ts test, pass/fail>

## Findings (aggregated)

### Must fix
(empty — all gates passed)

### Should fix
- [from efficiency-review] ...

### Consider
- [from independent-review] ...

## Links
- $RUN_DIR/acceptance-result.md
- $RUN_DIR/review-efficiency.md
- $RUN_DIR/review-security.md
- $RUN_DIR/user-value.md
- $RUN_DIR/eval-report.md
- $RUN_DIR/review-independent.md
```

If `review.md` has any **Must fix** items: stop, fix, re-run from Step 1. Don't compound or close on a failed review.

## Step 5 — Compound

Run `ai/workflows/compound.md`. Concretely:

1. **`ai/knowledge/pitfalls/<slug>.md`** — new file per failure mode discovered.
2. **`ai/knowledge/patterns/<slug>.md`** — new file per reusable approach.
3. **`ai/knowledge/test-patterns/<slug>.md`** — new file per reusable *testing* approach. If you learned how to verify a new class of feature (cross-tenant isolation, ranking-quality eval, hot-path latency proof), capture it here so the next agent doesn't re-derive it.
4. **`ai/STANDARDS.md`** — promote rules that should apply to all future work.
5. **`ai/checklists/`** — add items if a reviewer caught something existing checklists missed.
6. **`ai/knowledge/decisions/`** — ADR if significant architectural decision made.
7. **`ai/gates.config.mjs`** — if a gate fired falsely or missed a real trigger, refine the globs. This is how the gate system itself compounds.

Write `$RUN_DIR/compound.md` summarising what was captured (or explicitly "nothing new").

## Step 6 — Post to Linear and close

```bash
node tools/linear-cli.mjs comment {ISSUE_ID} --body "$(cat <<'EOF'
**Shipped** — \`ai/runs/YYYY-MM-DD_<issue>_name/\`

<one-paragraph summary>

## Gates
- acceptance: ✓ 5/5
- efficiency: ✓ within budget
- security: ✓ no findings
- user-value: ✓ attested
- eval: n/a

## Follow-ups
- <Should-fix / Consider items>
EOF
)"

node tools/linear-cli.mjs close {ISSUE_ID}
```

If there are Should-fix findings warranting follow-up issues, surface them to the user.

## Step 7 — Commit + push

```bash
git add ai/runs/<run>/ ai/knowledge/ ai/STANDARDS.md ai/checklists/ ai/templates/ ai/gates.config.mjs
git commit -m "docs: compound learnings from <run-name>"
```

Confirm with user before pushing / opening PR (`gh pr create`).

## Step 8 — Tell the user what shipped

Short summary:
- What was built (one sentence per capability)
- Gates that ran + their headline result
- Linear issue status (closed / follow-up issues created)
- Any open items the user should know about

---

## Cost discipline

Each gate has a cost. Manifest-driven dispatch means you only pay for what's relevant:

| Gate | Cost | When it runs |
|---|---|---|
| acceptance | Playwright run, no LLM | Always |
| efficiency | 1 LLM session | DB / hot-path / dep changes |
| security | 1 LLM session | Auth / route / dep / action changes |
| user-value | 1 LLM session (Claude in Chrome) | UI changes |
| eval | LLM judge × N cases | Quality-graded surface changes |
| independent | 1 LLM session | Recommended, gate by diff size |

Worst case (UI feature touching auth + DB + ranking + new dep): all five gates run. ~5 LLM sessions plus Playwright. Sane for a real feature ship.

Best case (typo fix, docs-only, schema-only): just acceptance (which is a no-op if no UI). Zero LLM cost.

This is the asymmetry the gate system buys you.
