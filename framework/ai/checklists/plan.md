# Plan Checklist

Verify before finalizing any plan.

## Problem definition

- [ ] Problem statement is specific and testable
- [ ] Scope is explicit with non-goals listed
- [ ] Assumptions and unknowns are captured

## Design

- [ ] Proposed design is minimal — no speculative features
- [ ] Key flows described end-to-end (happy path + errors)
- [ ] Data model changes specified (if any)
- [ ] Affected existing code identified
- [ ] Three-Surface table filled in (or exempt with stated reason)
- [ ] Any surface intentionally excluded has a stated reason

## Security

- [ ] Every new backend action that accepts a workspace/tenant ID includes an ownership check (verify the resource belongs to the requester)
- [ ] Every new HTTP route that accepts numeric body fields validates them at the HTTP layer (TypeScript types are not enforced at runtime on deserialized JSON)

## Risk

- [ ] Edge cases and failure modes enumerated
- [ ] Pre-mortem completed (what's most likely to go wrong?)
- [ ] Rollout/rollback noted if change affects production

## Completeness

- [ ] Linear issue referenced at top of plan ({ISSUE_PREFIX}-XXX + URL)
- [ ] Context consulted section lists pitfalls/patterns read
- [ ] Acceptance criteria are measurable and testable
- [ ] Task breakdown is sequenced with checkpoints
- [ ] Test plan covers: static checks, backend fn tests, API route tests, UI smoke test, CLI/API test

## Scope discipline

- [ ] I have NOT absorbed adjacent work that belongs in a separate issue
- [ ] "Notes for follow-on issues" lists anything tempting that I'm not doing here
