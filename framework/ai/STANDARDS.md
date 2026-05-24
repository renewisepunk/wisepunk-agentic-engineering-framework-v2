# Engineering Standards

These standards are enforced by the review workflow and checklists. Keep rules short, unambiguous, and enforceable.

Customize for your stack. Delete what doesn't apply. Add what does.

## General

- Keep changes small and reviewable.
- Favor clarity over cleverness.
- Make dependencies explicit; avoid hidden coupling.
- One purpose per function/module.

## Error handling

- Validate inputs at system boundaries (user input, external APIs).
- Fail fast with actionable error messages that include context.
- Do not swallow errors. Propagate with context or handle explicitly.

## Logging and observability

- Log at boundaries and on state transitions.
- Never log secrets, credentials, or PII.
- Use structured logs where the stack supports it.

## Testing

- New behavior requires tests.
- Cover failure paths and edge cases, not just the happy path.
- Tests must be deterministic and isolated.
- Name tests to describe the expected behavior, not the implementation.

## Security

- Principle of least privilege for all access.
- Sanitize and validate all untrusted input.
- Secrets are never committed to the repository.
- Review authn/authz on every new endpoint or action.

## Performance

- Avoid N+1 query patterns.
- Bound expensive operations (pagination, timeouts, limits).
- Document performance assumptions in hot paths.

## Documentation

- Public API changes require doc updates.
- Include examples for non-trivial features.
- Keep docs next to the code they describe.

## Three-Surface Rule

Every user-facing operation must be reachable from three surfaces: **UI**, **AI chat**, and **CLI / HTTP**.

> A "user-facing operation" is anything a user can invoke — create, list, update, delete, run, view. Schema-only and helper-only issues are exempt; state that explicitly in the plan.

**Canonical logic lives in a service function** (e.g. `lib/actions/<name>.ts` or a backend mutation). AI tools and HTTP routes are thin wrappers — they must not duplicate business logic inline.

**Before shipping any operation:**

1. Run `ai/checklists/ai-first.md` — all items must be checked.
2. Add an entry to `ai/knowledge/actions.md` — the authoritative manifest of every named operation.

The manifest is the source of truth for what the system can do. If an operation is not in the manifest, it does not officially exist.

If you have a strong reason not to want this rule (small project, no chat agent, no API surface), delete this section. But know that most of the framework's downstream tooling — the planning template, the AI-first checklist, the review process — leans on this rule. Removing it has knock-on effects.
