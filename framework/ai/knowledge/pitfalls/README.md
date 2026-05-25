# Pitfalls

Recurring mistakes and how to avoid them. **One file per pitfall** — agents add new entries by writing a new file, never by appending to a shared one. This avoids merge conflicts when multiple agents finish work in parallel.

Updated by the `compound` workflow.

## Frontmatter schema

Every pitfall file must begin with this YAML block:

```yaml
---
title: "<short human-readable title>"
tags: [kebab-tag1, kebab-tag2]
related: [other-pitfall.md]
created: YYYY-MM-DD
last_referenced: YYYY-MM-DD | null
---
```

- **tags:** derived from the filename slug — split on `-`, drop stopwords, keep domain nouns/verbs (max 8)
- **related:** sibling pitfall or pattern files that address the same area
- **last_referenced:** updated to today's date each time an agent reads this file during `/new-feature` planning

## How to add an entry

1. Pick a short kebab-case slug from the title (e.g. `react-controlled-input-fill-doesnt-fire-onchange.md`).
2. Create `ai/knowledge/pitfalls/<slug>.md` with frontmatter then body:

```markdown
---
title: "<Full title>"
tags: [tag1, tag2]
related: []
created: YYYY-MM-DD
last_referenced: null
---

**Symptom:** What does the failure look like? (Error message, observed behavior.)

**Root cause:** What's actually wrong underneath?

**How to recognize this:** Specific signals that point at this pitfall vs. similar-looking ones.

**Fix:** Concrete steps to resolve.

**Where this affects us:** (Optional) which files/areas of the codebase are vulnerable.
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
