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

## Context consulted

<!-- Which pitfall/pattern files did you read before writing this plan? List them here so the knowledge base usage is auditable. -->

- `ai/knowledge/pitfalls/...`
- `ai/knowledge/patterns/...`

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
