---
name: efficiency-review
description: Spawn a fresh agent that reviews the current branch through an efficiency lens — query plans, N+1, bundle size, hot-path latency, and Efficiency budget compliance from the plan. Use when the efficiency gate is required in gates.manifest.json, or standalone on any PR that touches DB queries, hot paths, or shipping dependencies.
---

# Efficiency Review

A specialist independent reviewer focused exclusively on performance and resource cost. Spawned by `/ship-feature` when the efficiency gate is `required` in `gates.manifest.json`.

The default `/independent-review` skill checks "no N+1, no unbounded ops" as one bullet. That's not enough. This skill compares the implementation against the **Efficiency budget** the plan declared, demands measurement evidence, and flags missing baselines.

## When to use

- `/ship-feature` invokes this when the efficiency gate triggers (per `ai/gates.config.mjs`).
- Standalone: when investigating "the dashboard got slower this week" — point this at the suspect PR.
- Before merging any change to a known hot path.

## What the reviewer gets

- `git diff origin/main...HEAD` — the changes
- `ai/runs/<run>/plan.md` — declared Efficiency budget
- `ai/runs/<run>/efficiency-evidence.md` if it exists — implementer's measurements
- `ai/runs/<run>/worklog.md` — measurements may be embedded here instead
- `ai/STANDARDS.md`
- `ai/checklists/efficiency.md`

## What the reviewer does NOT get

- `review.md` — implementer's conclusions
- Conversation history

(Note: the worklog IS given for this reviewer because measurements often live there. The implementer's *interpretive* narrative is filtered out by only consuming the measurement-relevant sections.)

## Step 1 — Gather inputs

```bash
RUN_DIR="${RUN_DIR:-$(ls -dt ai/runs/*/ | head -1)}"
DIFF=$(git diff origin/main...HEAD)
PLAN=$(cat "$RUN_DIR/plan.md")
EVIDENCE=$(cat "$RUN_DIR/efficiency-evidence.md" 2>/dev/null || echo "(not provided)")
WORKLOG=$(cat "$RUN_DIR/worklog.md" 2>/dev/null || echo "")
STANDARDS=$(cat ai/STANDARDS.md)
CHECKLIST=$(cat ai/checklists/efficiency.md)

# Bundle size diff (if frontend changed)
BUNDLE_DIFF=$(node tools/bundle-size-diff.mjs 2>/dev/null || echo "(not available — wire up bundle-size-diff per stack)")

# New DB queries (heuristic — grep for new query primitives)
NEW_QUERIES=$(git diff origin/main...HEAD | grep -E '^\+.*\b(ctx\.db|select\(|query\(|from\()' | head -30 || echo "")
```

## Step 2 — Spawn the specialist reviewer

```
Agent({
  description: "Efficiency review (specialist)",
  subagent_type: "general-purpose",
  prompt: `
You are an efficiency reviewer. You have NEVER seen this code before. Your scope
is performance and resource cost ONLY — query plans, latency, bundle size,
memory, background work cost. Do not comment on style, correctness, or
architecture unless they create a measurable cost issue.

## Plan with Efficiency budget
${PLAN}

## Implementer's measurement evidence
${EVIDENCE}

## Worklog (measurement snippets may be here)
${WORKLOG}

## Diff
\`\`\`diff
${DIFF}
\`\`\`

## Standards
${STANDARDS}

## Efficiency checklist
${CHECKLIST}

## New query-like statements detected
${NEW_QUERIES || "(none detected)"}

## Bundle size signal
${BUNDLE_DIFF}

## Your task

1. **Budget compliance.** Read the plan's Efficiency budget table. For each
   non-\`n/a\` row:
   - Is there a measurement in the evidence/worklog?
   - Does the measurement fall within budget?
   - If no measurement when the diff touches relevant files → Must fix.
   - If measurement exceeds budget → Must fix.

2. **Query review.** For every new query in the diff:
   - Indexed? (cite the index name from the schema)
   - Inside a loop? → N+1 → Must fix
   - Unbounded? → pagination or limit → Must fix
   - Joins on large tables? → flag for EXPLAIN

3. **Hot-path review.** For changes to known hot paths (per the checklist's
   trigger list — request handlers, render functions, server components):
   - Sync I/O? → flag
   - Naked LLM await (no timeout)? → Must fix
   - JSON parsing of large blobs? → flag

4. **Bundle review.** If \`package.json\` or frontend files changed:
   - New deps with weight > 50KB minified → justified in plan? If not, flag
   - "use client" directives → causing client-side pull of server-only code?
   - Dynamic imports used where appropriate?

5. **Background work.** New jobs/queues/cron:
   - Retry policy bounded?
   - Failures observable?
   - Idempotent?

6. Classify findings:
   - **Must fix** — exceeds budget, or measurement missing when required
   - **Should fix** — within budget but smell or trend
   - **Consider** — opportunity, not blocking

Cite \`file:line\`. Show numbers — "p95=180ms vs budget 150ms" is useful;
"slow" is not.

## Output format (markdown)

# Efficiency review — <run name>

## Summary
<one paragraph: did this PR stay within budget, and where's the risk?>

## Budget compliance table
| Dimension | Budget | Measured | Status |
|---|---|---|---|

## Query review
<one bullet per new query: indexed? bounded? location?>

## Hot-path review
<observations about hot-path changes>

## Bundle review
<delta + justification>

## Background work review
<jobs added + retry/observability assessment>

## Findings

### Must fix
- [file:line] <description with numbers>

### Should fix
- [file:line] <description>

### Consider
- [file:line] <description>

Stay under 1200 words. Numbers, not adjectives.
`
})
```

## Step 3 — Save the review

```
ai/runs/<run>/review-efficiency.md
```

## Step 4 — Check Must-fix items

If `review-efficiency.md` raises any Must-fix items (including "no measurement when measurement was required"):

- Print them prominently.
- Halt `/ship-feature`.
- Implementer must either re-measure, optimize, or update the budget (with justification) and re-run.

## Step 5 — Tell the user

- N Must-fix, N Should-fix, N Consider
- Headline budget breaches if any
- Link to `review-efficiency.md`

## Cost note

One extra Claude session per PR where the efficiency gate triggers. Selectivity from `gates.config.mjs` means this doesn't run on auth-only or docs-only PRs.
