# Patterns

One file per reusable approach. The positive twin of pitfalls.

## File format

```markdown
# <short, specific title>

**Problem:** What problem does this pattern solve?

**Solution:** What's the approach?

**Example:**
\`\`\`<lang>
<minimal code showing the pattern>
\`\`\`

**Why this beats the alternative:** What did you consider and reject, and why?

**Where we use it:** Files/areas of the codebase that follow this pattern.

---
*Captured: YYYY-MM-DD from ai/runs/<run>/*
```

## Naming

Same rules as pitfalls — kebab-case, specific, greppable.

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
