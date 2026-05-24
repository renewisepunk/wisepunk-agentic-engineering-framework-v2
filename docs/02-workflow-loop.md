# 02 — The Workflow Loop

Every piece of work flows through four steps: **plan → work → review → compound**. The skills (`/new-feature`, `/ship-feature`) wrap them so an agent runs the whole pipeline from a single command, but it's worth understanding each step.

---

## Step 1 — Plan

**Workflow file:** `ai/workflows/plan.md`
**Output:** `ai/runs/<date>_<issue>_<slug>/plan.md`
**Template:** `ai/templates/plan.md`

### What the plan contains

```markdown
# Plan: <Title>

**Date:** YYYY-MM-DD
**Linear:** ACM-XX — <url>
**Status:** Draft | Approved | Completed

## Problem
What is the problem? Why does it matter?

## Scope
### In scope
### Non-goals

## Assumptions and unknowns
| # | Assumption / Unknown | Status | Resolution |

## Design
### Key flows (happy path + error paths)
### Affected code

## Edge cases and failure modes
| # | Scenario | Handling |

## Acceptance criteria
1. Given ..., when ..., then ...

## Three-Surface Rule
| Capability | UI | AI chat | CLI/HTTP |

## Task breakdown
- [ ] Task 1

## Test plan
### TypeScript
### Backend function tests
### API routes
### UI smoke test
### CLI/API test

## Pre-mortem
- Most likely to go wrong:
- Edge case we'll probably miss:
- Blast radius if it fails:
- How we detect failure:

## Rollout / Rollback
```

### The discipline

- **One issue = one plan.** Don't bundle.
- **Acceptance criteria are testable.** "Works well" is not. "Given a user with no plays, when they open `/dashboard`, then the empty state shows the play recommendations component" is.
- **The Three-Surface table is filled in before code is written**, not after. It's a design decision, not an audit.
- **Pre-mortem is honest.** If you can't name what's most likely to go wrong, the plan isn't ready.

### When to stop and ask

The plan workflow lists explicit stop conditions:

- Requirements are ambiguous after one attempt to clarify
- Multiple viable designs exist with meaningfully different tradeoffs
- The change is likely to break backwards compatibility
- The scope is larger than expected

Don't power through these. Ask the human.

---

## Step 2 — Work

**Workflow file:** `ai/workflows/work.md`
**Output:** Code + tests + `ai/runs/<run>/worklog.md`

### The rhythm

1. **Read the plan again.** Especially acceptance criteria.
2. **Check pitfalls.** List `ai/knowledge/pitfalls/` and read any whose filename hints at relevance. This is how the system avoids repeating known mistakes.
3. **Implement in small increments.** One task from the plan at a time. Buildable and testable on its own. Committed separately.
4. **Write tests alongside code.** Not after. Each task's tests should pass before moving to the next.
5. **Keep a worklog.** Note:
   - Decisions made that weren't in the plan
   - Surprises or deviations
   - Things that were harder or easier than expected
   - Shortcuts taken and their justification
6. **Validate against acceptance criteria.** Before declaring done, verify every criterion.

### Worklog format

Free-form, but useful structure:

```markdown
## Task 1: <name>
- Decision: chose X over Y because <reason>
- Surprise: the existing helper Z already does most of this

## Task 2: <name>
- Deviated from plan: plan said use the schedule_runs table, but
  schedule_runs is owned by the scheduler. Created event_log instead.
- Justified by: separation of concerns + simpler ownership

## Deviations from the plan
- Plan estimated 3 hours; took 5 because <reason>
- Plan didn't anticipate <X>; handled by <Y>
```

The worklog feeds review AND compound. It's where the implementer's context lives.

### When to stop and ask

- The plan is wrong or incomplete
- A task is significantly harder than estimated
- A design decision comes up that the plan doesn't cover
- Tests reveal a flaw in the approach

---

## Step 3 — Review

**Workflow file:** `ai/workflows/review.md`
**Output:** `ai/runs/<run>/review.md`
**Checklist:** `ai/checklists/review.md`

### What gets reviewed

| Category | What to check |
|---|---|
| **Correctness** | All acceptance criteria met? Edge cases handled? Error paths covered? |
| **Testing** | Tests for new behavior? Failure paths covered? Deterministic? |
| **Security** | Inputs validated? Authn/authz on new endpoints? Secrets/PII protected? |
| **Performance** | N+1 patterns? Unbounded operations? Hot paths reasonable? Payloads bounded? |
| **Maintainability** | Readable? Consistent with codebase? Complexity justified? Public API documented? |

### Classifying findings

For each issue:

- **Must fix** — blocks merge
- **Should fix** — fix before next release
- **Consider** — nice-to-have

### The self-review trap

When the implementing agent also writes the review, it grades its own homework. Two mitigations:

- The review checklist (`ai/checklists/review.md`) forces specific checks rather than gestalt judgment.
- An **independent reviewer agent** (`/independent-review` skill) re-reviews with only the diff + plan + standards — no worklog, no implementation context. See [docs/04-skills.md](./04-skills.md#independent-review).

---

## Step 4 — Compound

**Workflow file:** `ai/workflows/compound.md`
**Output:** `ai/runs/<run>/compound.md` + edits to `ai/knowledge/` and `ai/STANDARDS.md`

This is the step that makes future work easier. Do not skip it.

### What to extract

1. **Reflect on the plan.**
   - What was wrong, missing, or underspecified?
   - What assumptions turned out to be incorrect?
   - What risks materialized? Were they anticipated?

2. **Reflect on implementation.**
   - What was harder than expected and why?
   - What decisions during implementation should have been in the plan?
   - Were there recurring friction points?

3. **Reflect on review findings.**
   - What bugs were found? What was the root cause?
   - Were there patterns in the issues?
   - What would have caught these issues earlier?

### What to write

| Artifact | When | File |
|---|---|---|
| **Pitfall** | A failure mode the next agent should avoid | `ai/knowledge/pitfalls/<slug>.md` — **new file**, not append |
| **Pattern** | An approach worth reusing | `ai/knowledge/patterns/<slug>.md` — **new file**, not append |
| **Standard** | A rule general enough for all future work | Edit `ai/STANDARDS.md` |
| **Checklist item** | A check the existing checklist missed | Edit `ai/checklists/*.md` |
| **ADR** | A significant architectural decision | `ai/knowledge/decisions/<slug>.md` |

### Why one file per pitfall/pattern

When two agents finish features simultaneously, both running compound, append-to-a-shared-file produces merge conflicts. One-file-per-entry doesn't. The cost is more files; the benefit is no conflicts.

### Quality gate

The compound step is done when you can answer "yes" to:

- Did I capture at least one concrete learning?
- Would a future agent benefit from what I wrote?
- Are the updates specific and actionable (not vague platitudes)?

If not, the compound run is theater.

---

## Run records

The four outputs (`plan.md`, `worklog.md`, `review.md`, `compound.md`) live under a single folder:

```
ai/runs/2026-05-24_ACM-42_add-schedules/
  plan.md
  worklog.md
  review.md
  compound.md
```

This folder is the audit trail. Months later, anyone (human or agent) can read it and understand what was asked, what was built, what was learned. Git tracks it like any other code.

---

## Next

- **Skills that wrap the loop:** [04-skills.md](./04-skills.md)
- **How compounding actually works:** [05-knowledge-compounding.md](./05-knowledge-compounding.md)
