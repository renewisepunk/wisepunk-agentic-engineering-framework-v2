# Patterns

Approaches that worked well and are worth reusing. **One file per pattern** — agents add new entries by writing a new file, never by appending to a shared one. This avoids merge conflicts when multiple agents finish work in parallel.

Updated by the `compound` workflow.

## Frontmatter schema

Every pattern file must begin with this YAML block:

```yaml
---
title: "<short human-readable title>"
tags: [kebab-tag1, kebab-tag2]
related: [other-pattern.md]
created: YYYY-MM-DD
last_referenced: YYYY-MM-DD | null
---
```

- **tags:** derived from the filename slug — split on `-`, drop stopwords, keep domain nouns/verbs (max 8)
- **related:** sibling pattern or pitfall files that address the same area
- **last_referenced:** updated to today's date each time an agent reads this file during `/new-feature` planning

## How to add an entry

1. Pick a short kebab-case slug from the title (e.g. `zod-validation-at-mutation-boundary.md`).
2. Create `ai/knowledge/patterns/<slug>.md` with frontmatter then body:

```markdown
---
title: "<Full title>"
tags: [tag1, tag2]
related: []
created: YYYY-MM-DD
last_referenced: null
---

**Problem:** What problem does this pattern solve?

**Solution:** What's the approach?

**Example:**
\`\`\`<lang>
<minimal code showing the pattern>
\`\`\`

**Why this beats the alternative:** What did you consider and reject, and why?

**Where we use it:** Files/areas of the codebase that follow this pattern.
```

## Naming

Kebab-case slugs, specific and greppable:

- ✓ `zod-validation-at-mutation-boundary.md`
- ✓ `convex-internal-fn-for-cross-table-queries.md`
- ✗ `nice-trick.md`
- ✗ `useful.md`

## When to write a pattern

- You solved a problem in a non-obvious way
- You combined two libraries / techniques in a way that wasn't documented
- You chose between two approaches and the choice mattered

## When NOT to write a pattern

- It's obvious — "we use TypeScript" isn't a pattern
- It's idiosyncratic to one situation
- It's just code — if the pattern is "use this function," put the function in the codebase and let people find it via grep
