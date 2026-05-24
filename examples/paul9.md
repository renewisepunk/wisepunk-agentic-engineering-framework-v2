# Example: Paul9

This is the reference implementation the framework was extracted from. Paul9 is an agentic GTM (go-to-market) AI product built by Wisepunk. The framework shipped **40+ PRs in 8 days** with a single human directing traffic.

This doc shows how each piece of the framework looks in a real, production setup.

---

## Stack at a glance

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 + React 19 + Tailwind v4 |
| Backend | Convex (database + auth + real-time + serverless functions) |
| Hosting | Vercel (auto-deploy on push to main) |
| Browser automation | Kernel.sh (VMs running Playwright) |
| Integrations | Composio (250+ OAuth tools) |
| AI | Vercel AI Gateway (multi-provider routing) |
| Auth | Clerk |
| Issue tracker | Linear (team key: `PAU`) |

---

## How the framework is set up

### 1. Linear integration

- **Team:** `Paul9` (key `PAU`)
- **Projects:** Foundation, Onboarding 2.0, Lead Gen & Email Outreach, Scheduling System, AI-First Action System, AEO Scanner, Cost Tracking, UI Smoke Tests, Agentic Engineering, etc.
- **API key:** in `.env.local` as `LINEAR_API_KEY`

Issues look like `PAU-42`. The CLI:

```bash
node tools/linear-cli.mjs list --team Paul9 --state Backlog --unassigned --limit 20
node tools/linear-cli.mjs claim PAU-42 --email rene@wisepunk.com
```

### 2. Backend isolation per worktree

`tools/bootstrap-worktree-backend.sh` creates a Convex **preview deployment** for each worktree.

Key details:
- Convex requires a *preview* deploy key (starts with `preview:`), not a dev key (starts with `dev:`). The script validates this — see pitfall `convex-preview-key-distinct-from-dev-key.md`.
- Per-branch env vars: `KERNEL_PAUL9_APP_NAME=paul9-<slug>`, `PAUL9_DEV_PORT=<3000+hash>`, `PAUL9_BRANCH_SLUG=<slug>`.
- Convex preview also gets `CONVEX_DEPLOYMENT=preview:<slug>` and `NEXT_PUBLIC_CONVEX_URL=<preview URL>`.

The actual stack-specific block in Paul9's bootstrap:

```bash
PREVIEW_KEY=$(grep '^CONVEX_PREVIEW_DEPLOY_KEY=' .env.local | head -1 | cut -d= -f2-)

if [[ "$PREVIEW_KEY" == dev:* ]]; then
  echo "ERROR: CONVEX_PREVIEW_DEPLOY_KEY is a dev key, not a preview key" >&2
  exit 1
fi

PREVIEW_OUTPUT=$(CONVEX_DEPLOY_KEY="$PREVIEW_KEY" \
  npx convex deploy --preview-create "$SLUG" \
    --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
    --cmd 'printenv NEXT_PUBLIC_CONVEX_URL' 2>&1 || true)

PREVIEW_URL=$(printf "%s" "$PREVIEW_OUTPUT" | grep -oE 'https://[a-z0-9-]+\.convex\.cloud' | tail -1)

sed -i.bak "s|^NEXT_PUBLIC_CONVEX_URL=.*|NEXT_PUBLIC_CONVEX_URL=$PREVIEW_URL|" .env.local
sed -i.bak "s|^CONVEX_DEPLOYMENT=.*|CONVEX_DEPLOYMENT=preview:$SLUG|" .env.local
```

### 3. External service per branch (Kernel)

Paul9 also has per-branch Kernel apps (`paul9-<slug>` vs main `paul9`). A separate tool, `tools/deploy-kernel.sh`, auto-detects `PAUL9_BRANCH_SLUG` from `.env.local` and deploys accordingly:

```bash
if grep -q '^PAUL9_BRANCH_SLUG=' .env.local; then
  SLUG=$(grep '^PAUL9_BRANCH_SLUG=' .env.local | cut -d= -f2-)
  APP_NAME="paul9-$SLUG"
else
  APP_NAME="paul9"
fi

KERNEL_API_KEY=$(grep KERNEL_API_KEY .env.local | cut -d= -f2-) \
  npx kernel deploy kernel/index.ts --env-file kernel/.env.kernel --app "$APP_NAME"
```

This is called out in CLAUDE.md / AGENTS.md as a "stack-specific reminder" — agents have to redeploy Kernel manually after any change to `kernel/` files.

### 4. CI

`.github/workflows/ci.yml` — tsc + eslint on changed files. The Convex codegen check was removed because it requires a deploy key in CI (caught indirectly by tsc).

`.github/workflows/smoke.yml` — half-built. Seeds a test user via `tools/seed-clerk.mjs`, then prints "Full smoke run requires agent-browser in the runner" as a TODO. PAU-174 (in the Agentic Engineering project) tracks finishing this.

### 5. Three-Surface Rule

Enforced via:
- `ai/STANDARDS.md` — the rule itself
- `ai/checklists/ai-first.md` — pre-ship checklist
- `ai/knowledge/actions.md` — the action manifest (every named operation registered)
- `ai/templates/plan.md` — the Three-Surface table is a required section

Real example (from `ai/knowledge/actions.md`):

```markdown
| Capability | UI | AI chat | CLI/HTTP |
|---|---|---|---|
| Create schedule | ScheduleForm → convex/schedules.ts:create | createSchedule tool in app/api/chat/tools/ → lib/actions/schedules.ts | POST /api/schedules → convex/http/schedules-create.ts |
| List leads | LeadsTable → convex/leads.ts:list | (intentionally excluded — would flood chat) | GET /api/leads → convex/http/leads-list.ts |
```

The "intentionally excluded" notation is important — it forces the agent to think about each surface even when skipping one.

### 6. Compounding knowledge

`ai/knowledge/pitfalls/` has ~30 entries after a month of fleet work. Examples:

- `convex-preview-key-distinct-from-dev-key.md` — wrong key type silently fails
- `react-controlled-input-fill-doesnt-fire-onchange.md` — use click + type, not fill
- `mcp-chrome-form-clicks-trigger-extension-popup.md` — use agent-browser for forms
- `convex-cli-has-no-preview-delete.md` — previews must auto-expire

`ai/knowledge/patterns/` has ~12 entries:

- `zod-validation-at-mutation-boundary.md`
- `convex-internal-fn-for-cross-table-queries.md`
- `lib-actions-as-shared-service-layer.md`

`/new-feature` reads pitfalls before planning. Most plans cite 2–3 pitfalls in "Context consulted."

---

## A real run

`ai/runs/2026-05-23_PAU-90_usage-events/` — an actual feature run:

```
plan.md         3 KB   Three-Surface table, test plan, pre-mortem
worklog.md      2 KB   "Deviated from plan: cost calc happens in logger, not at use site"
review.md       4 KB   Pass on 5/5 acceptance criteria, 2 should-fix findings
compound.md     1 KB   Captured 1 new pitfall (cost-calc-attribution.md), 1 pattern
```

The pitfall captured:

```markdown
# Cost attribution must happen at the use site, not in the logger

**Symptom:** Costs logged with workspaceId=null because the logger doesn't know
which workspace called it.

**Root cause:** The logger is a generic utility — it has no notion of "current
workspace." Wrapping it to know about workspaces would couple it to our domain.

**Fix:** Pass workspaceId as an explicit arg to the logger from the call site.
Use a helper if the call site doesn't naturally have it: `logCost({ workspaceId,
service, tokens, ... })`.

**Where this affects us:** convex/llm.ts, convex/kernel.ts, convex/firecrawl.ts.
```

This pitfall was read by 4 subsequent agent runs (per the worklog citations).

---

## Parallel agent activity

A typical afternoon:

```bash
$ tools/agent-status.sh
WORKTREE                  BRANCH                          ISSUE        PORT   DEV-SERVER  LAST COMMIT
--------------------------------------------------------------------------------------------------
PAU-90-usage-events       agent/PAU-90-usage-events       PAU-90       3034   running     a4f2c9 feat: log usage events
PAU-83-schedule-cron      agent/PAU-83-schedule-cron      PAU-83       3007   running     7b13e5 feat: cron tick
PAU-74-leads-enriched     agent/PAU-74-leads-enriched     PAU-74       3091   stopped     2c9af8 test: lead enrichment
PAU-127-aeo-content       agent/PAU-127-aeo-content       PAU-127      3018   running     e3d7b1 feat: content audit
PAU-155-mega-split        agent/PAU-155-mega-split        PAU-155      3055   running     f9a2d3 refactor: split chat tools
```

5 agents in flight, each on its own issue, its own preview backend, its own Kernel app, its own port. The human reviews and merges as PRs land.

---

## What we'd do differently in a fresh install

After living with the framework for a few weeks, things we'd recommend to anyone setting up fresh:

1. **Generic env var names from day 1.** We have `PAUL9_BRANCH_SLUG` and `KERNEL_PAUL9_APP_NAME` baked into everything. The framework uses `AGENTIC_BRANCH_SLUG` — start with that, it ages better.

2. **Per-file chat tools / HTTP routes from day 1.** Our mega-files (`app/api/chat/route.ts`, `convex/http.ts`) are recurring merge-conflict sources. PAU-176 (in Agentic Engineering project) is splitting them now — wish we'd done it at the start.

3. **Independent reviewer agent from day 1.** Tracked as PAU-175. Self-review systematically misses things; the cost of a second agent is small.

4. **Frontmatter on pitfalls.** PAU-177 — add tags + `last_referenced` so we can tell which knowledge is load-bearing vs. just accumulating. Without this, the knowledge base will rot.

5. **Test suite in CI from day 1.** PAU-174 — wire smoke into CI. We have the scenarios written; not wiring them was a mistake that lets bugs through.

These are tracked as open issues in our **Agentic Engineering** Linear project. They'll land in the framework as patches over time.

---

## Wisepunk Agentic Engineering project (in Paul9's Linear)

The meta-project for improving the framework itself:

- [PAU-174](https://linear.app/paul9/issue/PAU-174) — Wire UI smoke into CI
- [PAU-175](https://linear.app/paul9/issue/PAU-175) — Independent reviewer agent
- [PAU-176](https://linear.app/paul9/issue/PAU-176) — Finish mega-file split
- [PAU-177](https://linear.app/paul9/issue/PAU-177) — Compound knowledge gate (dedup + tagging)
- [PAU-178](https://linear.app/paul9/issue/PAU-178) — Auto-validate action manifest

When these ship, the framework gets corresponding upgrades.

---

## Why share this

Building Paul9 with this framework was the highest-leverage engineering experience of the team's careers. One human directed traffic for a fleet of 5–10 agents shipping features in parallel; the codebase got *easier* to work in over time because of the compound step; the Three-Surface Rule kept everything legible.

We extracted the framework so others can do the same. If it works for you, [tell us](https://github.com/renewisepunk). If it doesn't, [tell us why](https://github.com/renewisepunk/wisepunk-agentic-engineering-framework/issues).
