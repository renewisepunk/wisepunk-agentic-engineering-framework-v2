# Security Review Checklist

Run by `/security-review` when the security gate triggers. The fresh reviewer agent gets only the diff, plan, and this checklist — no implementer context.

Default disposition for ambiguity: **escalate**, not approve. A false positive costs a follow-up commit; a missed authz bug costs a customer.

---

## Authentication

- [ ] Every new HTTP route validates auth before doing anything (session, JWT, or API key)
- [ ] Auth failure returns `401` with no information about why (don't disclose user existence)
- [ ] No new route bypasses the project's standard auth middleware
- [ ] Anonymous routes are explicitly justified in the plan

## Authorization (the cross-tenant bug class)

- [ ] Every data read scoped to the authenticated user/workspace/org — never trusts an id from the request body alone
- [ ] Every data write checks the actor has permission to modify the target resource
- [ ] Role/permission checks happen in the service function, not just the route handler
- [ ] **Tenant isolation test exists:** user A cannot read or write user B's data via the new endpoint
- [ ] If admin-only: admin check is enforced server-side, not just hidden in UI

## Input validation

- [ ] All untrusted inputs validated at the boundary with a schema (zod, pydantic, etc.)
- [ ] Length limits on every string field that could grow unbounded
- [ ] File uploads: type checked, size checked, content scanned if executable
- [ ] No raw user input concatenated into SQL, shell commands, HTML, or file paths

## Injection vectors

- [ ] SQL: parameterized queries only; no string interpolation
- [ ] Shell: no `exec`/`spawn` with user input; if unavoidable, allow-list args
- [ ] HTML: framework's escape used; no `dangerouslySetInnerHTML` with user data
- [ ] Path: no `path.join` with user input that could include `..` segments
- [ ] LLM prompt injection: user content clearly delimited from system instructions; tool calls validated against the user's actual scope

## Secrets and PII

- [ ] No new secret committed to the repo (grep the diff for tokens, keys)
- [ ] No secret in logs, error messages, or HTTP responses
- [ ] PII (email, phone, address, payment, identity) is not logged
- [ ] PII not echoed in error messages back to clients
- [ ] New env vars documented in `.env.example` or equivalent

## Rate limiting and abuse

- [ ] User-facing write endpoints have rate limits (or use existing middleware)
- [ ] Expensive operations (LLM calls, file generation, batch jobs) have per-user quotas
- [ ] No endpoint can be used to enumerate users, emails, or resource IDs

## Dependencies

- [ ] If `package.json` / `requirements.txt` changed: new deps named in the plan with justification
- [ ] Run vulnerability check on new deps (`pnpm audit` / `npm audit` / `pip-audit`)
- [ ] No deps from unverified publishers or single-maintainer abandoned packages
- [ ] Lockfile updated; no `^` or `~` ranges introduced that weren't there before

## Auto-scaffolded tests for new HTTP routes

For each new HTTP route in the diff, the security reviewer expects to see (or scaffolds):

- [ ] `no-auth-returns-401.spec.ts` — calling the route without auth returns 401
- [ ] `wrong-tenant-returns-403.spec.ts` — calling with user A's session against user B's resource returns 403 or 404 (not 200)
- [ ] `invalid-input-returns-400.spec.ts` — schema validation rejects malformed payloads

These ship as Playwright/Vitest stubs into `ai/runs/<run>/acceptance.spec.ts` alongside the feature's own acceptance cases.

---

## Findings format

Classify each finding as:

- **Must fix** — exploit possible, blocks merge
- **Should fix** — hardening / defense-in-depth, fix before release
- **Consider** — opinion or future improvement

Cite `file:line` for every finding. Never hedge — if it's exploitable, say so.
