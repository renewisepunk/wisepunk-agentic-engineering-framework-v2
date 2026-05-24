# Pitfalls

One file per failure mode. Never append to a shared file — per-entry files avoid merge conflicts when parallel agents finish simultaneously.

## File format

```markdown
# <short, specific title>

**Symptom:** What does the failure look like? (Error message, observed behavior.)

**Root cause:** What's actually wrong underneath?

**How to recognize this:** Specific signals that point at this pitfall vs. similar-looking ones.

**Fix:** Concrete steps to resolve.

**Where this affects us:** (Optional) which files/areas of the codebase are vulnerable.

---
*Captured: YYYY-MM-DD from ai/runs/<run>/*
```

## Naming

Kebab-case slugs that describe the symptom or the cause. Be specific so future agents can grep:

- ✓ `convex-preview-key-distinct-from-dev-key.md`
- ✓ `react-controlled-input-fill-doesnt-fire-onchange.md`
- ✗ `bug-1.md`
- ✗ `convex-issues.md`

## When to write a pitfall

You hit a failure that:

- The next agent could easily hit too
- Wasn't obvious from reading the code
- Had a non-obvious fix

If the failure is obvious from a stack trace and the fix is "read the error message" — skip. Save pitfall files for genuine non-obviousness.

## When to remove a pitfall

- The underlying issue is fixed in a library version you've since upgraded past
- The code area the pitfall warned about has been refactored away
- The pitfall is a duplicate of a more general one

Don't leave stale entries. They confuse the next agent's grep.
