# Review Checklist

Verify before approving any implementation.

## Correctness

- [ ] Meets all acceptance criteria from the plan
- [ ] Handles edge cases and failure paths
- [ ] Errors are actionable with context — no silent failures
- [ ] No regressions in existing behavior
- [ ] Three-Surface Rule: every capability reachable via UI, AI chat tool, and CLI/HTTP route

## Testing

- [ ] New behavior is covered by tests
- [ ] Failure paths are tested, not just happy paths
- [ ] Tests are deterministic and isolated
- [ ] Tests describe behavior, not implementation details

## Security

- [ ] Untrusted inputs validated and sanitized
- [ ] No secrets or PII in logs or responses
- [ ] Access controls correct for new endpoints/actions
- [ ] No new injection vectors (SQL, XSS, command)

## Performance

- [ ] No N+1 queries or unbounded operations
- [ ] Large payloads bounded or paginated
- [ ] Hot paths are reasonable and documented

## Maintainability

- [ ] Code is readable and consistent with codebase style
- [ ] Public API changes documented
- [ ] Complexity is justified — no speculative abstraction
- [ ] No dead code or unused imports left behind
