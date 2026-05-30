# Plan: <Title>

**Date:** YYYY-MM-DD
**Linear:** {ISSUE_PREFIX}-XXX — <issue URL>
**Status:** Draft | Approved | Completed

## Problem

<!-- What is the problem? Why does it matter? One paragraph. -->

## User value

<!-- Who is the user, and what outcome makes this feature valuable to them?
     This is checked by the user-value gate. If you can't articulate it, the
     feature probably shouldn't ship. -->

- **User persona:** <!-- e.g., "First-time signup", "Power user with 5+ workspaces", "API integrator" -->
- **User's goal:** <!-- What they're trying to accomplish, in their words -->
- **Success signal (observable):** <!-- What does a successful use of this feature look like *from the user's vantage point*? Not "endpoint returns 200" — "user sees their schedule on the dashboard within 2 seconds of clicking Save" -->
- **Failure signal (observable):** <!-- What would tell us this feature isn't delivering value? -->

## Scope

### In scope

-

### Non-goals

-

## Assumptions and unknowns

| # | Assumption / Unknown | Status | Resolution |
|---|---------------------|--------|------------|
| 1 | | Open | |

## Design

<!-- Minimal viable design. Interfaces, data model changes, key flows. -->

### Key flows

<!-- Describe the happy path and main error paths. -->

### Affected code

<!-- List files/modules that will be changed. -->

## Edge cases and failure modes

| # | Scenario | Handling |
|---|----------|----------|
| 1 | | |

## Acceptance criteria

<!-- Each must be testable. Use Given/When/Then format. These are scaffolded
     into ai/runs/<run>/acceptance.spec.ts by Playwright Agent CLI during
     /new-feature, then run by /ship-feature. -->

1. Given ..., when ..., then ...

## Three-Surface Rule

Every user-facing capability must be reachable from all three surfaces. Fill in this table before implementation starts. If a surface is intentionally excluded, state why.

If this issue is schema-only or helper-only (no user-facing capability), state that here and skip the table:

> "This issue is internal/schema-only; Three-Surface does not apply."

| Capability | UI (component → backend fn) | AI chat (tool in chat route → service fn) | CLI/HTTP (route → service fn) |
|---|---|---|---|
| | | | |

## Help doc

Every user-facing operation needs a help doc. Fill this section at planning time. `/ship-feature` will check that the file exists before opening a PR.

If this issue adds no user-facing operations (schema-only, internal cron, framework change), use `—` with a one-line reason:

```
— internal tooling only; no user-facing operation to document
```

Otherwise, for each new operation:

| Field | Value |
|---|---|
| Slug | `<kebab-case-slug>` |
| Category | `<Category>` |
| File | `ai/help/<Category>/<slug>.md` |
| Summary | One sentence describing what the user learns from this doc |
| Actions offered | List the action buttons (e.g. drop_prompt / navigate) |
| Body outline | 2–4 bullet points of the sections the body will cover |

## Efficiency budget

<!-- What does this feature cost? Set the budget *before* implementation so
     the efficiency reviewer has something concrete to check against. Leave a
     row blank with "n/a" if a dimension doesn't apply. -->

| Dimension | Baseline (current) | Budget (max acceptable) | Notes |
|---|---|---|---|
| Hot-path latency (p95) | | | <!-- which endpoint / page -->|
| DB queries per request | | | <!-- list each query if novel -->|
| Bundle size delta | | | <!-- only if shipping frontend code -->|
| Background job cost | | | <!-- only if shipping async work -->|

## Gate scope

<!-- Filled by /new-feature based on the gate classifier. Edit if needed and
     justify any opt-outs with a one-line reason. /ship-feature will re-run
     the classifier and flag discrepancies for semantic review.

     Format: `<gate>: required` OR `<gate>: skipped — "reason"`

     The `acceptance` gate cannot be opted out (planOptOutAllowed: false). -->

- acceptance: required
- user-value: <!-- required | skipped — "reason" -->
- security: <!-- required | skipped — "reason" -->
- efficiency: <!-- required | skipped — "reason" -->
- eval: <!-- required | skipped — "reason" -->

## Context consulted

<!-- List every pitfall/pattern/test-pattern file you actually opened during planning (not just listed).
     For each file opened, also update its last_referenced frontmatter field to today's date. -->

- `ai/knowledge/pitfalls/...`
- `ai/knowledge/patterns/...`
- `ai/knowledge/test-patterns/...`

## Task breakdown

<!-- Sequenced. Each task is independently completable. -->

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Test plan

### TypeScript / static checks
- `<command>` must pass after every task

### Backend function tests
<!-- For each new function: what inputs/outputs need a test? -->
-

### API routes
<!-- curl commands for each new HTTP route — valid + invalid input -->
-

### Acceptance spec (Playwright)
<!-- Scaffolded at ai/runs/<run>/acceptance.spec.ts. Each acceptance criterion
     above maps to one or more test cases. /ship-feature runs `npx playwright test`
     against this spec. -->
- One test per acceptance criterion

### User-value walkthrough
<!-- Golden path the user persona above takes. Performed by Claude in Chrome
     during /ship-feature; produces ai/runs/<run>/user-value.md with screenshots
     and an attestation. -->
-

### Eval suite (if applicable)
<!-- Only for quality-graded surfaces (search, ranking, AI outputs).
     Lives in ai/eval-suites/<feature>.jsonl. -->
-

## Pre-mortem

- **Most likely to go wrong:**
- **Edge case we'll probably miss:**
- **Blast radius if it fails:**
- **How we detect failure:**

## Rollout / Rollback

<!-- How to deploy. How to revert. Skip if not applicable. -->

## Notes for follow-on issues

<!-- Things you noticed but are out of scope for THIS issue. Don't absorb them — note them and move on. -->

-
