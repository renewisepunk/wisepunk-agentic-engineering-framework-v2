---
name: security-review
description: Spawn a fresh agent that reviews the current branch through a security lens — authentication, authorization (especially cross-tenant), input validation, injection, secrets/PII, rate limiting, dependency vulnerabilities. Use when the security gate is required in gates.manifest.json, or standalone on any PR that touches auth, HTTP routes, or service actions.
---

# Security Review

A specialist independent reviewer focused exclusively on security. Spawned by `/ship-feature` when the security gate is `required` in `gates.manifest.json`, or callable on its own.

The default `/independent-review` skill is generalist — it covers a lot of ground shallowly. For diffs that touch auth, HTTP routes, or service actions, the security pass needs depth that doesn't fit in a general checklist.

## When to use

- `/ship-feature` invokes this when the security gate triggers (per `ai/gates.config.mjs`).
- Standalone audit: when refactoring an auth flow or adding a new route family.
- Before any change to `lib/auth/**`, `middleware.ts`, or `app/api/**/route.ts`.

## What the reviewer gets

- `git diff origin/main...HEAD` — the changes
- `ai/runs/<run>/plan.md` — declared scope and Three-Surface table
- `ai/STANDARDS.md` — project security rules
- `ai/checklists/security.md` — **the deep checklist**
- Listing of `ai/knowledge/pitfalls/` (so it can grep for security-flavored pitfalls)

## What the reviewer does NOT get

- `worklog.md` — implementer's narrative would anchor it
- `review.md` — implementer's conclusions would anchor it
- Conversation history

## Step 1 — Gather inputs

```bash
RUN_DIR="${RUN_DIR:-$(ls -dt ai/runs/*/ | head -1)}"
DIFF=$(git diff origin/main...HEAD)
PLAN=$(cat "$RUN_DIR/plan.md")
STANDARDS=$(cat ai/STANDARDS.md)
CHECKLIST=$(cat ai/checklists/security.md)
PITFALLS=$(ls ai/knowledge/pitfalls/ 2>/dev/null || echo "")

# Find new HTTP routes specifically — the reviewer needs to know which to scaffold tests for
NEW_ROUTES=$(git diff origin/main...HEAD --name-only --diff-filter=A | grep -E '(api/.*/route\.(ts|tsx)|http\.ts)' || echo "")
```

## Step 2 — Spawn the specialist reviewer

Use the Agent tool. The prompt must be self-contained — the spawned agent has zero context.

```
Agent({
  description: "Security review (specialist)",
  subagent_type: "general-purpose",
  prompt: `
You are a security reviewer. You have NEVER seen this code before. You are paid
to be paranoid. Default to escalating ambiguity, not approving it.

Your scope is security ONLY. Do not comment on style, naming, architecture, or
performance unless they create a security issue. Other reviewers cover those
dimensions.

## Plan (what was supposed to be built)
${PLAN}

## Diff (what actually got built)
\`\`\`diff
${DIFF}
\`\`\`

## Standards
${STANDARDS}

## Security checklist (work through every section)
${CHECKLIST}

## Pitfalls available (grep for any security-flavored ones)
${PITFALLS}

## New HTTP routes in this diff
${NEW_ROUTES || "(none)"}

## Your task

1. Work through every section of the security checklist. For each item, mark
   pass / fail / n/a with one line of evidence (file:line).

2. Pay extra attention to the authorization (cross-tenant) section — this is
   the highest-impact bug class in multi-tenant apps and the easiest to miss.
   For every new endpoint that reads or writes user data, prove (cite code)
   that user A cannot access user B's data via this endpoint.

3. For each new HTTP route in the list above, verify the diff includes (or
   scaffold a stub for):
   - no-auth → 401 test
   - wrong-tenant → 403/404 test
   - invalid-input → 400 test
   If the implementer didn't add these, flag as Must fix and provide the stub.

4. If package.json or the lockfile changed, list every new dependency and
   note any with known CVEs, unverified publishers, or maintenance concerns.

5. Classify each finding:
   - **Must fix** — exploit possible
   - **Should fix** — hardening
   - **Consider** — opinion

Cite \`file:line\` for every finding. Never hedge — if it's exploitable, say so.

## Output format (markdown)

# Security review — <run name>

## Summary
<one paragraph: overall risk posture and headline findings>

## Checklist walkthrough
<one line per checklist item: ✓ / ✗ / n/a + evidence>

## Authorization deep-dive
<for each new endpoint, the tenant-isolation proof>

## Dependency scan
<new deps + risk assessment>

## Findings

### Must fix
- [file:line] <description>

### Should fix
- [file:line] <description>

### Consider
- [file:line] <description>

## Suggested test stubs
<Playwright/Vitest stubs for the no-auth / wrong-tenant / invalid-input tests>

Stay under 1200 words. Be specific.
`
})
```

## Step 3 — Save the review

Write the spawned agent's output to:

```
ai/runs/<run>/review-security.md
```

## Step 4 — Apply test stubs (if any)

If the reviewer produced test stubs in its "Suggested test stubs" section, append them to `ai/runs/<run>/acceptance.spec.ts` (or the project's equivalent test file). The implementer or `/ship-feature` runs them.

## Step 5 — Check Must-fix items

If `review-security.md` raises any Must-fix items:

- Print them prominently to the user.
- Halt the `/ship-feature` flow.
- Wait for the implementer to either:
  - Fix the issue and commit (then re-run `/ship-feature`)
  - Respond inline in `review-security.md` arguing why the finding is wrong (the human arbitrates)

## Step 6 — Tell the user

Summarize:
- N Must-fix, N Should-fix, N Consider findings
- Link to `review-security.md`
- New test stubs added (if any)
- Next step: fix or proceed

## Cost note

This adds ~one extra Claude session per PR where the security gate triggers. The gate triggers selectively (per `gates.config.mjs`), so you're not paying for it on docs-only or schema-only changes.
