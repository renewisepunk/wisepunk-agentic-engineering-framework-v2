# Test Patterns

Reusable testing recipes — alongside `pitfalls/` and `patterns/`, this is the third compounding knowledge surface. While patterns capture "how to build feature class X", test-patterns capture "how to **verify** feature class X."

## Why this exists

Every agent that builds a search feature shouldn't re-derive how to write a search eval suite. Every agent that builds a multi-tenant endpoint shouldn't re-derive how to test cross-tenant isolation. The first agent figures it out; subsequent agents read the recipe and apply it.

## Format

One file per recipe. Greppable filenames. Specific content.

```markdown
---
name: cross-tenant-isolation-test
applies_when: "Adding a new HTTP route or service action that reads or writes user-scoped data"
gates: [security, acceptance]
---

# Cross-tenant isolation test pattern

**Problem:** A new endpoint accidentally lets user A read user B's data.

**Recipe:**
1. Create two seeded test users (A and B) with one record each in the target table.
2. In Playwright, log in as A using storageState fixture.
3. Hit the endpoint with B's resource id in the URL or body.
4. Assert: response is 403 or 404 (NOT 200 with B's data).
5. Repeat for every verb the endpoint supports (GET, PATCH, DELETE).

**Spec stub:**
\`\`\`ts
test('user A cannot read user B's <resource>', async ({ page }) => {
  await page.goto(\`/api/<resource>/\${USER_B_RESOURCE_ID}\`);
  // expect 403 or 404
});
\`\`\`

**Where this came from:** PAU-78 (we shipped a leaky `/api/leads/[id]` route and caught it in independent review).
```

## When to write a new test-pattern

After `/ship-feature` completes a feature where:

- The testing approach was non-obvious and took non-trivial thought
- The same testing approach will apply to future features in the same class
- The pattern isn't already documented here

This is the compound step asking "what did we learn about *testing* this class of feature?" — not "what bug did we find" (that's a pitfall) and not "how did we build it" (that's a pattern).

## Where these get read

- `/new-feature` Step 1 (context loading) lists this directory and skims relevant ones.
- `/security-review` and `/efficiency-review` reviewers receive the listing and grep for relevant recipes before writing their reviews.
- The acceptance spec author (Playwright Agent CLI invocation during `/new-feature`) can be passed a relevant test-pattern to seed the spec.

## Anti-patterns

- **Don't duplicate `patterns/`.** A pattern describes how to build; a test-pattern describes how to verify. If your file is half-and-half, split it.
- **Don't write a test-pattern for a one-off.** If the recipe won't apply to a second feature, it doesn't belong here — leave it in the run's `review.md`.
- **Don't write vague patterns.** "Test the happy path" is not a pattern. "Seed two tenants, log in as A, request B's resource by id, assert 403" is.
