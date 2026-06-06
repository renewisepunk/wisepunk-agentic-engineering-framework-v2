# 06 — Testing, Validation, and CI

How the framework verifies that shipped work is **secure**, **efficient**, **functionally correct**, and **delivers user value** — without running every check on every PR.

> If you only read one section, read **The validation philosophy** below.

---

## The validation philosophy

A naive validation system runs every check on every PR. It crushes velocity. Engineers (and agents) skip checks under deadline pressure. The system that's "always thorough" becomes the system that's "never run."

The framework instead routes work through a **gate-driven** validation flow:

1. A classifier inspects the diff + the plan, decides which gates apply, writes `gates.manifest.json`.
2. `/ship-feature` runs **only the gates the manifest marks `required`**.
3. Each gate has a cost (LLM session, Playwright run, walkthrough time). Selectivity is what lets us afford to be thorough on the things that matter.

A docs-only PR triggers zero gates beyond acceptance (which is a no-op when no UI changed). A feature that touches auth + DB + ranking + adds a dep triggers all five. The gates that fire are the ones that *could find something*.

---

## The five gates

| Gate | Lens | Tool | Triggers (default; tune in `ai/gates.config.mjs`) |
|---|---|---|---|
| **acceptance** | Does it functionally do what the plan said? | Playwright (deterministic) | Always-on |
| **user-value** | Does a real user get value from this? | Claude in Chrome / agent-browser (judgment) | UI / page / component changes |
| **security** | Authn, authz, injection, PII, deps | `/security-review` (specialist LLM) | Auth files, HTTP routes, service actions, package.json |
| **efficiency** | Budget compliance, queries, bundle, latency | `/efficiency-review` (specialist LLM) | DB files, hot paths, deps, page bundles |
| **eval** | Quality of graded outputs (search, AI) | `tools/eval-runner.mjs` (LLM-as-judge) | Search, ranking, agent prompts |

### Why these five, in this order

- **Acceptance** runs first because it's cheap (no LLM) and broken-golden-path means nothing else matters.
- **Efficiency** before security: budget breaches are objective (numbers); security is judgment-heavy and benefits from acceptance passing first.
- **Security** before user-value: a security finding can change the implementation, which would invalidate the walkthrough.
- **User-value** last because it requires the deployment to be stable.
- **Eval** is independent of the others and parallel-safe.

---

## Tool division of labor: Playwright vs. Claude in Chrome vs. agent-browser

These aren't competing tools — they have different jobs. Forcing one tool everywhere is what wastes effort.

| Use case | Best tool | Why |
|---|---|---|
| **Acceptance specs** (run on every PR forever) | **Playwright Agent CLI** | Authored once, runs deterministically in CI with no LLM cost. Rich assertions (`expect.toBeVisible`), trace viewer, video on failure, retries, `storageState` for auth. Specs are checked into the repo → become a regression net. |
| **User-value walkthrough** (one-off, judgment) | **Claude in Chrome / agent-browser** | The agent plays the user persona, judges "does this feel right?", screenshots key moments. LLM-in-the-loop is the *point*. Don't try to write this as a Playwright assertion. |
| **AI eval suites** (quality grading) | **Pure scripts + LLM-as-judge** | No browser needed. `tools/eval-runner.mjs` runs JSONL cases and scores outputs against rubrics. |
| **Efficiency capture** | **Playwright perf API + Lighthouse CI** | Piggyback on the acceptance run for web-vitals; bundle-size from CI artifacts. |
| **Debugging "why is this broken?"** | **Claude in Chrome** | When you don't know what's wrong, you need an LLM driving exploration, not a deterministic test runner. |

### The compounding win from Playwright Agent CLI

Every feature that ships leaves behind a real Playwright spec at `ai/runs/<run>/acceptance.spec.ts`. After 50 features, you have 50 acceptance specs running in CI. Real regression net, authored cheaply, no LLM cost to re-run.

This is qualitatively different from Claude in Chrome, where every check is a fresh LLM session that costs money each time.

### When NOT to use Playwright Agent CLI

For the **user-value gate**, deliberately use Claude in Chrome instead. Encoding "does this feel discoverable?" as a Playwright assertion is a category error — the *whole point* of that gate is human-like judgment. If you find yourself writing 20 `expect()` calls trying to assert "feels right", you've drifted into the wrong tool.

---

## The smart-gating system

### Configuration: `ai/gates.config.mjs`

Each gate declares when it runs:

```js
export default {
  gates: {
    security: {
      triggers: [
        "app/api/**/route.ts",
        "convex/http.ts",
        "lib/auth/**",
        "lib/actions/**",
        "package.json",
      ],
      skipExtensions: [".test.ts", ".md"],
      planOptOutAllowed: true,
    },
    // ... other gates
  },
};
```

- `triggers` — globs. Any matched file in the diff triggers the gate.
- `skipExtensions` — extensions that don't count as triggers (test/docs).
- `planOptOutAllowed` — whether the plan can declare `skipped` for this gate (acceptance is always required).

### Classifier: `tools/gate-classifier.mjs`

Deterministic. Reads the config + the diff + the plan's Gate scope section. Writes `ai/runs/<run>/gates.manifest.json`.

```bash
node tools/gate-classifier.mjs --run ai/runs/2026-05-28_ACM-42_name
```

Exit codes:
- `0` — manifest written, no discrepancies
- `1` — error
- `2` — discrepancies between plan and globs → caller (the `/ship-feature` skill) runs a semantic LLM override

### Two-layer gating

1. **Layer 1 — deterministic globs.** Fast, free, predictable. Catches ~90% of cases.
2. **Layer 2 — semantic LLM override.** Only fires when the classifier exited 2 (discrepancies found). Reads the diff context + plan justification and resolves: was the plan right, were the globs right, or escalate?

This keeps cost low (no LLM call on most PRs) while catching the edge cases globs miss.

### Plan-declared opt-outs

The plan template includes a Gate scope section:

```markdown
## Gate scope

- acceptance: required
- user-value: required
- security: skipped — "schema-only change, no new attack surface"
- efficiency: required
- eval: skipped — "no quality-graded surfaces touched"
```

`/new-feature` fills this in based on planned scope. `/ship-feature` re-classifies based on actual diff and flags discrepancies. Honest opt-outs save cost; dishonest ones get caught.

---

## CI: the always-on layer

Before any gate runs, CI catches the basics on every push:

```yaml
# framework/.github/workflows/ci.template.yml
- TypeScript (tsc --noEmit, full repo)
- Lint (changed files only — fast)
- Concurrency: cancel in-progress on new push
```

Plus the pre-push hook for GitHub Free / no-rulesets repos:
- Refuses direct pushes to `main`
- Lints changed files locally before allowing push

These run on *every* push and are not gated — they're the floor, not the ceiling.

---

## The merge gates

### Option A — GitHub branch protection (Pro+)
Server-side. Require CI / check; require branches up to date; require PR.

### Option B — Client-side pre-push hook (Free)
```bash
bash tools/setup-hooks.sh
```
Refuses direct pushes; lints changed files. Escape hatch: `FORCE_DIRECT_PUSH=1 git push origin main`.

---

## Authoring eval suites

The eval gate triggers on quality-graded surfaces (search, ranking, AI agent outputs). See `framework/ai/eval-suites/README.md` for the full spec; the short version:

- One `.jsonl` per feature surface at `ai/eval-suites/<feature>.jsonl`.
- Each line: `{ id, input, rubric, expected?, weight? }`.
- `rubric` is one plain-English sentence the LLM judge reads.
- Seed cases from real production traces, not invented inputs.
- Mix easy/medium/hard via `tags`.

---

## Authoring acceptance specs with Playwright Agent CLI

The acceptance gate triggers always. Specs are scaffolded by Playwright Agent CLI during `/new-feature` from the GWT criteria in `plan.md`. The spec exists *before* implementation — TDD-shaped.

### Setup (one-time per project)

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps
npm install --save-dev @playwright/agent-cli   # or whatever the install command is for your version
```

Configure `playwright.config.ts` with the preview URL pattern (per-branch backend), the `storageState` strategy for auth, and the test directory glob `ai/runs/**/acceptance.spec.ts`.

### Authenticating the specs

Most acceptance specs run as a signed-in user — but you can't just drive the login form in CI: the auth provider's bot detection, "new-device" / MFA email codes, and CAPTCHA block it. Worse, it fails *silently* — a non-blocking smoke that never actually authenticates still goes green, so a project can ship auth-gated changes for weeks against a hollow check. Use the provider's **test bypass** to get a real session, sign in **once** in global setup, and cache it with `storageState` so every spec starts authed.

- **Clerk:** `@clerk/testing`'s `setupClerkTestingToken()` injects a Testing Token that bypasses bot detection. (The sign-in ticket must be a query param — not a `#/?__clerk_ticket=` hash; and handle the org-setup step if Organizations are enabled.)
- **Other systems:** Auth0 password-grant on a test tenant, a test-env-guarded `/api/test-login` for NextAuth/custom, `supabase.auth.signInWithPassword`, etc. — same shape, different bypass.

This is also **why auth-gated specs use Playwright, not agent-browser**: only Playwright can rewrite the provider's API requests to inject the token (agent-browser can only abort/mock). Judgment walkthroughs can still use Claude-in-Chrome — but load the saved `storageState` instead of signing in through the UI. Full recipe + worked Clerk example: `ai/knowledge/test-patterns/playwright-auth.md`.

### Per-feature flow

1. `/new-feature` reads the plan's acceptance criteria, invokes Playwright Agent CLI:
   ```bash
   npx playwright agent author --plan plan.md --out acceptance.spec.ts
   ```
2. The CLI produces one `test('Given X, when Y, then Z')` block per criterion, each starting with `test.fixme()` (so the build fails until implementation lands).
3. The implementer writes code; removes `fixme` markers as criteria are satisfied.
4. `/ship-feature` Step 3a runs the spec; remaining `fixme` markers fail the gate.

### When Playwright Agent CLI isn't available

Hand-author stubs as `test.fixme(...)` blocks. Document selectors strategy and auth setup in `ai/knowledge/test-patterns/playwright-base.md` so future specs follow it.

---

## The specialist reviewers

Two new skills sit alongside `/independent-review`:

### `/security-review`
Fresh agent, security-only scope. Gets `ai/checklists/security.md` (deep checklist), the diff, the plan. Outputs `review-security.md` with findings classified Must/Should/Consider. Auto-scaffolds no-auth/wrong-tenant/invalid-input tests for new HTTP routes.

### `/efficiency-review`
Fresh agent, efficiency-only scope. Gets `ai/checklists/efficiency.md`, the plan's Efficiency budget, and the implementer's measurements. Demands measurement evidence — if missing, fails the gate.

Both run only when their gate is `required` in the manifest. Both spawn fresh agents with no implementer context (no worklog, no review.md).

---

## The verify-as-user walkthrough (user-value gate)

Run via Claude in Chrome on the preview deployment. Process:

1. Read `plan.md`'s User-value section (persona, goal, success signal).
2. Open the preview URL as the persona (fresh signup vs. established workspace).
3. Walk the golden path. Capture screenshots.
4. Verify against `ai/checklists/user-value.md`: discoverability, first-use clarity, happy path, error states, empty states, mobile.
5. Cross-surface equivalence: UI/chat/CLI all return the same underlying data.
6. Write the attestation: does this deliver value? Yes/No/Partially with reasoning.

If the attestation is No or Partially, the gate fails. Fix or escalate.

---

## Test patterns (the new knowledge surface)

`ai/knowledge/test-patterns/` is where *testing recipes* compound — alongside `pitfalls/` and `patterns/`.

A pattern describes "how to build feature class X." A test-pattern describes "how to **verify** feature class X." Examples:

- `cross-tenant-isolation-test.md`
- `ranking-quality-eval.md`
- `hot-path-latency-proof.md`
- `playwright-auth.md` (authenticating e2e through Clerk / other providers — shipped)

The compound step in `/ship-feature` writes a new test-pattern when the testing approach for this feature class was non-obvious and will apply to future features. The next agent reads it during `/new-feature` Step 1.

---

## Common failure modes

- **TypeScript passes but the feature is broken.** Acceptance gate catches this — Playwright runs the actual feature, not just type-checks.
- **Feature passes acceptance but is useless.** User-value gate. Discoverability problems, confusing copy, hidden CTAs.
- **Feature passes acceptance but is slow / expensive.** Efficiency gate. Force budget declaration at plan time; demand measurement at ship time.
- **Feature passes acceptance but leaks data across tenants.** Security gate. Auto-scaffolded wrong-tenant test catches the common form.
- **AI feature passes acceptance but the answers are bad.** Eval gate. Functional ≠ quality.
- **Gates ran but didn't catch the bug.** Compound step: write a new pitfall + add to the relevant checklist. Promote to a standard if it's a class.

---

## Migrating an existing project

If you're adopting this on a project that already uses `/ship-feature`:

1. Copy `framework/ai/gates.config.mjs` to `ai/gates.config.mjs`. Tune triggers for your stack.
2. Copy `framework/tools/gate-classifier.mjs` and `framework/tools/eval-runner.mjs` to `tools/`.
3. Copy the new checklists: `security.md`, `efficiency.md`, `user-value.md`.
4. Install the two specialist skills: `security-review/SKILL.md`, `efficiency-review/SKILL.md`.
5. Update your plan template (or use the new template wholesale).
6. The new `/ship-feature` SKILL.md replaces the old one — backward-compatible for runs that pre-date the gate system (no manifest → all gates skip with a one-line warning; treat as legacy).

Run one feature through end-to-end before dispatching parallel work; it surfaces stack-specific tuning the defaults didn't cover.

---

## Next

- **Linear setup:** [07-linear-integration.md](./07-linear-integration.md)
- **Customizing for your stack:** [08-customizing.md](./08-customizing.md)
- **Troubleshooting:** [09-troubleshooting.md](./09-troubleshooting.md)
