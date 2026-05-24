# 06 — Testing and CI

Three layers of testing, plus the merge gates that protect main. Most teams under-invest in layer 2 and over-invest in layer 1; this section is opinionated about why.

---

## The three layers

### Layer 1 — Static + unit (CI-blocking)

What runs on every PR:

- **TypeScript** — `tsc --noEmit` across the whole repo
- **Lint** — on changed files (faster than whole-repo)
- **Codegen drift** — caught indirectly by tsc

These are fast (<2 min), deterministic, and cheap to run on every push. The shipped `framework/.github/workflows/ci.template.yml` does all three.

### Layer 2 — UI smoke (manual or PR-triggered)

A small set of scenarios that drive the real app in a real browser against a real backend, with a real seeded test user.

This is what catches "the button renders but does nothing" and "the API returns 200 but the data didn't save" — the bugs that pure-unit tests miss.

**The framework doesn't ship a UI smoke harness** because the right one depends heavily on your stack. But it ships the **structure**:

```
ai/test-suites/
  AGENT.md          # runbook for an agent driving tests
  HUMAN.md          # runbook for a human clicking through
  _format.md        # scenario file format
  onboarding/       # fresh-user flows
  power-user/       # full-workspace flows
  cli/              # backend-route smoke (curl-driven)
```

Each scenario is one Markdown file:

```markdown
### Scenario: Schedule a play via chat

**Goal:** One sentence — what this verifies.
**Starting URL:** /dashboard

**Steps:**
1. ...
2. ...

**Pass criteria:**
- [ ] Observable assertion 1
- [ ] No console errors
```

Drive the suite with the [agent-browser](https://github.com/anthropics/agent-browser) skill or your own Playwright/Cypress wrapper.

### Layer 3 — Verify-in-browser (per-feature)

For UI changes, the implementing agent should start the dev server and confirm the feature in a real browser before shipping. This is the cheapest, most-effective test: "I tested the actual feature manually before saying it works."

The `verify` skill formalizes this (start dev server → screenshot → confirm). The `ui-test` skill drives it for authenticated flows.

---

## The CI workflow

The shipped `ci.template.yml` runs on every PR and every non-main push:

```yaml
name: CI
on:
  pull_request:
  push:
    branches-ignore: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: TypeScript
        run: npx tsc --noEmit
      - name: ESLint (changed files only)
        run: |
          BASE="origin/${{ github.event.pull_request.base.ref || 'main' }}"
          CHANGED=$(git diff --name-only --diff-filter=ACMR "$BASE"...HEAD -- '*.ts' '*.tsx' \
            | grep -v -E '^(node_modules/|\.next/|.*_generated/)' || true)
          [ -z "$CHANGED" ] && exit 0
          echo "$CHANGED" | xargs npx eslint
```

Adapt for non-Node stacks. The key principles:

- **Fast.** <2 minutes ideal.
- **Per-PR concurrency** — cancel in-progress runs when a new commit lands.
- **Lint changed files only** — full-repo lint is slow and noisy on existing debt.

---

## Merge gates

### Option A — Branch protection (GitHub Pro+)

The right answer for paid GitHub. Set up branch protection rules on `main`:

- Require status checks to pass before merging → select "CI / check"
- Require branches to be up to date before merging
- Require a pull request before merging
- *(optional)* Require linear history

Server-side enforcement. No escape, no client-side workaround.

### Option B — Client-side pre-push hook (GitHub Free)

GitHub Free doesn't have rulesets for private repos. The framework ships `.githooks/pre-push` as the fallback:

```bash
bash tools/setup-hooks.sh   # points core.hooksPath at .githooks/
```

The hook:

- Refuses direct pushes to `main` (open a PR instead).
- Runs lint on changed files before allowing push (catches what CI would catch later, faster).

Escape hatch for emergencies: `FORCE_DIRECT_PUSH=1 git push origin main`.

`spawn-agent.sh` activates the hook automatically for new worktrees. For Agent View-dispatched worktrees, the hook applies because `core.hooksPath` is shared across all worktrees once configured on the main repo.

---

## The independent reviewer as a third gate

If you've enabled the `/independent-review` skill, every PR gets reviewed by a second agent with no implementer context (see [04-skills.md](./04-skills.md#independent-review)). Its Must-fix findings block close.

This catches the class of bugs that:

- The implementer agent overlooked because it knew what it *meant* to do
- The CI suite doesn't cover (logic bugs, missing edge cases)
- A human would catch in code review but maybe doesn't because the PR was already approved

Cost: ~one extra Claude session per PR.

---

## Common failure modes

- **TypeScript passes but the app is broken.** Layer 2 (smoke) is your friend. Don't ship UI changes without exercising the real UI.
- **Tests pass locally, fail in CI.** Almost always env vars or timing. Add the missing secret to GitHub Actions repo settings; or convert flaky tests to deterministic ones.
- **Pre-commit hook flake.** The hook lints, which has a real failure mode (lint rules disagree with intent). If you hit this often, raise the bar of what counts as a lint error (downgrade warnings).
- **CI takes >5 min.** Investigate. Likely culprits: full-repo lint, large test suite without sharding, slow Docker image. Speed of feedback matters more than thoroughness for the merge gate.

---

## What to add later

The shipped framework is intentionally minimal. As you grow:

- **Visual regression** (Percy, Chromatic) — catches "the button moved 2px and we didn't notice" before users do.
- **Performance budgets** (Lighthouse CI) — catches "we shipped a 4MB bundle" before it lands.
- **Smoke against production previews** — most platforms generate per-PR preview URLs; run the smoke suite against them, not localhost.
- **Flake tracker** — the Paul9 reference ships `tools/flake-tracker.mjs` that auto-files repeat smoke failures to Linear after 3 consecutive FAILs. Copy when your suite stabilizes.

---

## Next

- **Linear setup in depth:** [07-linear-integration.md](./07-linear-integration.md)
- **Customizing for your stack:** [08-customizing.md](./08-customizing.md)
