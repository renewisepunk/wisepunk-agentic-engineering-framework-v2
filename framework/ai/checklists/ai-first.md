# AI-First Checklist (Three-Surface Rule)

Run this checklist before marking any issue that adds a user-facing operation as done.

A "user-facing operation" is anything a user can invoke — create, list, update, delete, run, view. Schema-only or helper-only issues are exempt; state that explicitly in the plan.

---

## Pre-ship checks

- [ ] Backend function exists for this operation (mutation, query, or action — whatever your backend's primitive is)
- [ ] AI chat tool's `execute()` calls the backend fn or a `lib/actions/` service function (not inline logic)
- [ ] HTTP route exposes it with auth (API key or session)
- [ ] CLI has a command for it (or a ticket exists for the planned command)
- [ ] Entry added to `ai/knowledge/actions.md` (the action manifest)

---

## Notes

**Canonical logic** — stateless or stateful operations should live in one place (`lib/actions/` or backend functions). Both the AI tool and the HTTP route call this place. Don't duplicate business logic inline.

**Auth on HTTP routes** — every route must validate authentication before doing anything. The pattern depends on your stack (API key validation, session cookie, JWT). Be consistent.

**Intentional exclusions** — if a surface is genuinely not applicable (read-only helper with no CLI analogue, e.g.), state why in the plan rather than silently skipping. The checklist item must still be acknowledged.

**The manifest** — `ai/knowledge/actions.md` is the source of truth for what the system can do. Adding to it is mandatory; auditing it is a recurring task (PRs welcome for a script that validates the manifest against the codebase).
