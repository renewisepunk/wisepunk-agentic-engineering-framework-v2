# User-Value Walkthrough Checklist

Run by `/ship-feature` when the user-value gate triggers. The implementing agent walks the feature as the user persona declared in `plan.md`, using Claude in Chrome / agent-browser. Output goes to `ai/runs/<run>/user-value.md` with screenshots and an attestation.

A feature can pass every functional test and still fail to deliver value. This gate is the last line of defense against "it works but it's useless."

---

## Before walking through

- [ ] Read the **User value** section of `plan.md` — who is the user, what is their goal, what success/failure looks like
- [ ] Start the dev server pointing at this branch's preview backend (not main)
- [ ] Open a real browser session as the user persona — fresh signup if "first-time user", established workspace if "power user"

## The walkthrough

For each declared user persona and acceptance criterion:

- [ ] **Discoverability** — can the user find this feature without being told where it is? If not, why not?
- [ ] **First-use clarity** — without reading docs, does the user understand what the feature does and how to use it?
- [ ] **Happy path** — the golden path completes in under N clicks (where N is reasonable for the feature) and shows the success signal declared in the plan
- [ ] **Speed perception** — does the feature *feel* fast? (Subjective; if a spinner shows for > 1s, note it)
- [ ] **Error states** — induce each declared failure mode. Does the user see an actionable error, or a stack trace / silent failure?
- [ ] **Empty states** — when there's no data, what does the user see? Is it helpful or confusing?
- [ ] **Mobile/responsive** — if the feature has a UI, does it work at 375px width? Screenshot at both desktop and mobile widths.

## Cross-surface consistency

If the plan's Three-Surface table lists this feature on multiple surfaces:

- [ ] UI surface: capture the success signal as a screenshot
- [ ] AI chat surface: ask the AI to perform the same action; verify the result matches the UI's
- [ ] CLI/HTTP surface: hit the endpoint with `curl`; verify the response data matches the UI's view
- [ ] **Equivalence** — all three surfaces return the same underlying data for the same input (no divergent caching, no silent transformation)

## Value attestation

After the walkthrough, the implementing agent answers in `user-value.md`:

1. **Does this feature deliver the value declared in the plan?** Yes / No / Partially — with one-paragraph reasoning, citing the screenshots.
2. **Would the declared user persona pay attention to this feature, or scroll past it?** Honest answer.
3. **What's the single most likely reason a real user gives up before completing the happy path?**
4. **What surprised you during the walkthrough that wasn't in the plan?**

If the answer to #1 is "No" or "Partially", the gate fails — fix or escalate before continuing `/ship-feature`.

---

## Output structure

`ai/runs/<run>/user-value.md`:

```markdown
# User-value walkthrough — <feature>

**Date:** YYYY-MM-DD
**Persona walked:** <name from plan>
**Goal walked:** <user's goal from plan>

## Screenshots

- `golden-path-1.png` — <one line caption>
- `golden-path-2.png` —
- `error-state-1.png` —
- `mobile-375.png` —

## Cross-surface check

| Surface | Result | Matches plan? |
|---|---|---|
| UI | <observed> | ✓ |
| AI chat | <observed> | ✓ |
| CLI/HTTP | <observed> | ✓ |

## Attestation

1. **Delivers value?** Yes / No / Partially. <reasoning>
2. **Persona attention?** <answer>
3. **Most likely give-up point?** <answer>
4. **Surprises:** <answer>

## Findings

- **Must fix** —
- **Should fix** —
- **Consider** —
```

---

## When to use Claude in Chrome vs. Playwright

This walkthrough is **judgment-based**, not deterministic. Use Claude in Chrome / agent-browser, not Playwright:

- Playwright is for asserting "this exact behavior happens" (acceptance.spec.ts).
- Claude in Chrome is for asking "does this *feel* right?" — LLM-in-the-loop is the point.

The acceptance gate runs Playwright. The user-value gate runs Claude in Chrome. They are complementary, not redundant.
