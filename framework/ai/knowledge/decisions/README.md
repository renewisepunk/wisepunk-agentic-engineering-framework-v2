# Decisions (ADRs)

Architecture Decision Records. One file per significant decision.

## When to write an ADR

When you make a decision that:

- Is hard to reverse
- Would surprise a future reader
- Required choosing between meaningfully different options
- Affects how the system grows from here

## When NOT to write an ADR

- "We chose this variable name because…" — just code
- "We added a button here because…" — PR description suffices
- "We refactored X" — commit message suffices

## File format

```markdown
# ADR-NNN: <decision>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-XXX

## Context

What problem are we solving? What constraints apply?

## Decision

What did we decide?

## Alternatives considered

What did we reject and why?

## Consequences

What does this make easy? What does this make hard? What might we want to revisit later?
```

## Naming

`ADR-NNN-<slug>.md` where NNN is a 3-digit sequence number. Examples:

- `ADR-001-use-convex-as-backend.md`
- `ADR-002-linear-assignee-as-the-lock.md`
- `ADR-003-pitfalls-per-file-not-shared.md`

ADRs are append-only. If a decision changes, write a new ADR that supersedes the old one (and update the old one's Status to "Superseded by ADR-XXX").
