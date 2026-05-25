# Plan: <Title>

**Date:** YYYY-MM-DD
**Linear:** {ISSUE_PREFIX}-XXX — <issue URL>
**Status:** Draft | Approved | Completed

## Problem

<!-- What is the problem? Why does it matter? One paragraph. -->

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

<!-- Each must be testable. Use Given/When/Then format. -->

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

## Context consulted

<!-- List every pitfall/pattern file you actually opened during planning (not just listed).
     For each file opened, also update its last_referenced frontmatter field to today's date. -->

-

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

### UI smoke test
<!-- Golden path a user takes through the feature. What to verify. -->
-

### CLI/API test
<!-- curl commands verifying each HTTP route end-to-end -->
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
