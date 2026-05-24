# 05 — Knowledge Compounding

The compound step is the system's memory. Without it, every agent makes the same mistakes the last one made. With it, the codebase gets easier to work in over time.

This doc is about what to capture, how to capture it, and how to keep the knowledge base from rotting.

---

## What gets captured

| Artifact | When you write one | Where it lives |
|---|---|---|
| **Pitfall** | A failure mode the next agent should avoid | `ai/knowledge/pitfalls/<slug>.md` |
| **Pattern** | An approach worth reusing | `ai/knowledge/patterns/<slug>.md` |
| **Standard** | A rule general enough for all future work | Edit `ai/STANDARDS.md` |
| **Checklist item** | A check the existing checklist missed | Edit `ai/checklists/*.md` |
| **ADR** | A significant architectural decision | `ai/knowledge/decisions/<slug>.md` |

---

## Pitfalls — the most-used artifact

### What a good pitfall looks like

```markdown
# Convex preview deploy key is distinct from the dev deploy key

**Symptom:** `npx convex deploy --preview-name X` fails with "invalid deploy key"
even though the same key works for `npx convex dev`.

**Root cause:** Convex issues separate keys for dev vs. preview deployments. The
key on the dashboard at Settings → Deploy Keys is the dev key. Preview keys are
generated separately at Settings → Preview Deploy Keys.

**How to recognize this:** The key starts with `dev:` instead of `preview:`.

**Fix:** Generate a preview-specific key from the Convex dashboard, save it as
`CONVEX_PREVIEW_DEPLOY_KEY` in `.env.local`, and use it for preview operations.

**Where this affects us:** `tools/bootstrap-worktree-backend.sh` validates the
key format and errors out early if a dev key was provided.

---
*Captured: 2026-05-23 from ai/runs/2026-05-23_PAU-90_usage-events/*
```

### What a bad pitfall looks like

```markdown
# Be careful with Convex

Convex can be tricky. Watch out for keys.
```

The difference is **specificity**. A pitfall must tell the next agent (a) how to recognize the symptom, (b) what the root cause was, and (c) what to do about it. If it can't, it's not worth writing.

### One file per pitfall (always)

Never append pitfalls to a shared file. Two agents running compound simultaneously would conflict. One file per pitfall, one new file per run, zero conflicts.

### Naming

Kebab-case slugs that describe the symptom or the cause:

- ✓ `convex-preview-key-distinct-from-dev-key.md`
- ✓ `mcp-chrome-form-clicks-trigger-extension-popup.md`
- ✓ `react-controlled-input-fill-doesnt-fire-onchange.md`
- ✗ `bug-1.md`
- ✗ `convex-issues.md`

The filename is the first thing a future agent sees in the directory listing — make it greppable.

---

## Patterns — the under-used artifact

Patterns are the positive twin of pitfalls: approaches that worked and are worth doing again.

### When to write a pattern

- You solved a problem in a non-obvious way that other agents will face
- You combined two libraries / techniques in a way that wasn't documented
- You chose between two approaches and the choice mattered (one was clearly better)

### Pattern format

```markdown
# Validate Convex args at the boundary with zod, not inside the function

**Problem:** Convex's built-in arg validators are limited; rich validation
(regex, conditional fields, enum union types) gets unreadable.

**Solution:** Use zod schemas at the function entry point. Wrap with a small
`validatedMutation()` helper that runs the schema and throws a typed error.

**Example:**
\`\`\`ts
export const createSchedule = validatedMutation(
  z.object({
    workspaceId: z.string(),
    cron: z.string().regex(/^[\d\*\/]+ [\d\*\/]+ \* \* \*$/),
    playId: z.string(),
  }),
  async (ctx, args) => { /* ... */ }
);
\`\`\`

**Why this beats the alternative:** Convex args are validated at runtime; this
gives the same guarantee but with zod's richer type inference and error messages.
Used in `convex/schedules.ts` and `convex/leads.ts`.

---
*Captured: 2026-05-24 from ai/runs/2026-05-24_PAU-83_schedules/*
```

### When NOT to write a pattern

- It's obvious — "we use TypeScript" isn't a pattern.
- It's idiosyncratic — "I named this variable `x` because" isn't a pattern.
- It's just code — if the pattern is "use this function," put the function in the codebase and let people find it via grep, not via a doc.

---

## How the knowledge flows back in

`/new-feature` reads pitfalls and patterns **before planning**. The skill's Step 5 ("Read context") lists `ai/knowledge/pitfalls/` and `ai/knowledge/patterns/` and skims any whose filename hints at relevance.

This is the entire loop:

```
Agent A ships feature X → writes pitfall "Y can break Z"
       ↓
Agent B starts feature W → reads pitfall list → sees "Y can break Z"
       ↓
Agent B avoids the same mistake when implementing W
```

For this to work, **filenames must be greppable** and **content must be specific**. Vague pitfalls don't get caught by Agent B's filename scan.

---

## Standards updates — when to promote

A pitfall becomes a standard when:

- The same class of bug shows up 3+ times across different features.
- The fix is the same every time.
- The fix is a rule that applies to all future work, not just one area.

Example progression:

1. Three separate pitfalls about Convex actions accepting `workspaceId` without checking ownership.
2. Realize this is a class of bug, not three isolated cases.
3. Promote to `ai/STANDARDS.md`: "Every Convex action that accepts `workspaceId` must verify `workspace.userId === identity.subject`."
4. Add a corresponding item to `ai/checklists/plan.md`.

The promotion is what makes the standards earn their place — they all came from real bugs, not from theorizing about what *might* go wrong.

---

## ADRs — for architectural decisions

When you make a decision that's hard to reverse and would surprise a future reader, write an ADR. Format:

```markdown
# ADR: <decision>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-X

## Context
What problem are we solving? What constraints apply?

## Decision
What did we decide?

## Alternatives considered
What did we reject and why?

## Consequences
What does this make easy? What does this make hard? What might we want to revisit?
```

Examples of ADR-worthy decisions:

- "We use Convex instead of Postgres because…"
- "We use Linear assignee as the lock instead of a database row because…"
- "Pitfalls are per-file instead of appended because…"

Examples of non-ADR-worthy decisions:

- "We chose this variable name because…" (just code)
- "We added a button here because…" (PR description suffices)

---

## Keeping the knowledge base from rotting

This is the under-solved problem with the framework today. As pitfalls accumulate, two failure modes appear:

1. **Duplicates** — two pitfalls saying the same thing because the second agent didn't grep before writing.
2. **Stale entries** — pitfalls about a library version we no longer use, or a bug that's since been fixed in upstream.

### Mitigations the framework ships with

- One file per pitfall (so dedup by reading the directory listing is fast).
- Filename specificity (greppable filenames are searchable).
- Compound workflow explicitly asks "did I check for an existing pitfall before writing this one?"

### Mitigations to add (PRs welcome)

- **Frontmatter with tags + `last_referenced`** — track which pitfalls actually got read by `/new-feature`. Unreferenced pitfalls after N months are candidates for deletion.
- **LLM-grade dedup at write time** — when compound creates a new file, score it against neighbors with matching tags; flag if similarity > 0.8.
- **Usage report** — `tools/knowledge-usage.mjs` that prints unreferenced pitfalls, high-traffic patterns, tag distribution.

These improvements are tracked as future work — see the Paul9 reference implementation's `PAU-177` for a detailed design.

---

## Next

- **How CI gates the whole loop:** [06-testing-and-ci.md](./06-testing-and-ci.md)
- **Linear setup:** [07-linear-integration.md](./07-linear-integration.md)
