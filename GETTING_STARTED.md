# Getting Started

This guide takes you from "empty repo" to "first shipped feature via the agent loop" in about 30 minutes.

If you're integrating the framework into an existing repo, the same steps apply — the installer is non-destructive (won't overwrite existing files without confirmation).

---

## Prerequisites

| What | Why | Where to get it |
|---|---|---|
| **Claude Code v2.1.139+** | Required for Agent View (`claude agents`) and background sessions | https://claude.com/claude-code |
| **A Linear workspace** | Issues are the work queue | https://linear.app |
| **A Linear personal API key** | The framework's CLI talks to Linear directly | linear.app → Settings → Account → Security → New API key |
| **Git + bash** | Worktrees + scripts | macOS/Linux: built-in. Windows: WSL. |
| **Node.js 20+** | linear-cli.mjs runs on Node | https://nodejs.org |
| *(optional)* A backend with preview deployments | For parallel-agent isolation. Convex, Supabase, PlanetScale all work. | See [docs/08-customizing.md](./docs/08-customizing.md) |

---

## Step 1 — Install

In the root of your project (existing or fresh):

```bash
git clone https://github.com/renewisepunk/wisepunk-agentic-engineering-framework-v2 /tmp/waef
bash /tmp/waef/framework/tools/install.sh
```

The installer:

1. Copies `framework/ai/` → `your-repo/ai/`
2. Copies `framework/.agents/` → `your-repo/.agents/`
3. Copies `framework/tools/` → `your-repo/tools/` (merges if a `tools/` directory already exists)
4. Copies `framework/.githooks/` → `your-repo/.githooks/`
5. Writes `AGENTS.md` and `CLAUDE.md` at the repo root (asks before overwriting)
6. Copies `framework/.github/workflows/ci.template.yml` → `your-repo/.github/workflows/ci.yml` (asks before overwriting)
7. Prompts for your Linear team name and issue prefix (e.g. team "Acme" with prefix "ACM") and substitutes them into the templates
8. Adds `tools/` and `ai/` to `.gitignore`'s exception list if needed

When it finishes, you'll have:

```
your-repo/
  AGENTS.md
  CLAUDE.md
  ai/
  .agents/
  tools/
  .githooks/
  .github/workflows/ci.yml
```

---

## Step 2 — Fill in CONTEXT.md

`ai/CONTEXT.md` is the project brief every agent reads first. Fill it in with:

- What the project does (one paragraph)
- Who the users are
- Architecture overview (link or describe)
- Stack + critical libraries with versions
- Environments (dev / staging / prod URLs and deploy commands)
- Constraints (performance, security, compliance)
- Non-goals (what this project is NOT)

A template lives at `ai/CONTEXT.template.md`. Rename to `CONTEXT.md` and edit. Treat it as a living doc — update when stack or architecture changes.

---

## Step 3 — Customize STANDARDS.md

`ai/STANDARDS.md` ships with a generic base (error handling, testing, security, the Three-Surface Rule). Read through it, delete what doesn't apply to your stack, add what does.

Standards that ship by default:

- General — small changes, clarity over cleverness, one purpose per function
- Error handling — validate at boundaries, fail fast, don't swallow errors
- Testing — new behavior requires tests, deterministic and isolated
- Security — least privilege, sanitize inputs, no secrets in repo
- Performance — no N+1, bound expensive ops
- Documentation — public API changes need docs
- **Three-Surface Rule** — every user-facing operation reachable via UI, AI chat, and CLI/HTTP

The Three-Surface Rule is the most-enforced. It's what makes the codebase legible to AI agents (every capability is in three predictable places). If you don't want it, delete that section — but understand what you're giving up.

---

## Step 4 — Linear setup

### 4a. Get an API key

linear.app → Settings → Account → Security → Personal API keys → New API key.

Add it to your repo's `.env.local`:

```bash
echo "LINEAR_API_KEY=lin_api_xxxxx" >> .env.local
```

Confirm `.env.local` is in `.gitignore`. The installer adds it; check anyway.

### 4b. Verify the CLI works

```bash
node tools/linear-cli.mjs list --team YourTeamName --state Backlog --limit 5
```

You should see JSON for up to 5 backlog issues.

### 4c. Decide your issue prefix

Linear teams have a key like `ACM` for "Acme". Issues then look like `ACM-1`, `ACM-2`. The installer asked you for this; if you skipped it, edit `ai/STANDARDS.md`, `ai/templates/plan.md`, and `.claude/skills/*/SKILL.md` to replace `{ISSUE_PREFIX}` with your actual prefix.

---

## Step 5 — (Optional) Wire up parallel-agent backend isolation

If you have a backend that supports preview deployments (Convex, Supabase, Vercel, etc.), agents can each get their own isolated backend per branch. This is what makes 30 agents in parallel actually work.

Without this, agents share one dev backend and will step on each other.

The framework ships a `tools/bootstrap-worktree-backend.sh` stub that allocates a unique dev port per branch. To add backend isolation:

1. Copy `tools/bootstrap-worktree-backend.sh` to start from
2. Add the steps for your stack: create preview deployment, write its URL into the worktree's `.env.local`
3. See [examples/paul9.md](./examples/paul9.md) for a fully-worked Convex + Kernel example
4. See [docs/08-customizing.md](./docs/08-customizing.md) for stack-specific recipes (Convex, Supabase, Vercel)

You can skip this for now and add it later — single-agent flow works without it.

---

## Step 6 — Activate the pre-push merge gate

```bash
bash tools/setup-hooks.sh
```

This points `core.hooksPath` at `.githooks/`. The included `pre-push` hook:

- Blocks direct pushes to `main` (open a PR instead)
- Runs lint on changed files before allowing push

On GitHub Pro+, you can replace this with server-side branch protection. On free-tier GitHub on private repos, this hook is your only merge gate.

---

## Step 7 — Ship your first feature

Pick a small Linear issue and run the loop end-to-end.

### 7a. Open Agent View

```bash
claude agents
```

### 7b. Spawn an agent on the issue

```
> /new-feature ACM-1
```

(Replace `ACM-1` with a real issue ID.)

What happens:

1. The skill claims the issue in Linear (sets you as assignee, moves to In Progress).
2. Claude creates a worktree under `.claude/worktrees/<auto-name>/`.
3. If backend isolation is configured: a preview deployment is created.
4. The skill writes `ai/runs/<date>_ACM-1_<slug>/plan.md` and posts a summary as a Linear comment.
5. The agent stops. **It does not start coding yet** — you review the plan first.

### 7c. Review the plan (optional but recommended for first run)

Open `ai/runs/<date>_ACM-1_<slug>/plan.md`. Check the Three-Surface table, acceptance criteria, and test plan. Edit if anything's off.

### 7d. Tell the agent to implement

In the Agent View session:

```
> Proceed with implementation per the plan.
```

The agent will work through tasks, writing tests alongside code, keeping `worklog.md` updated.

### 7e. Ship

When the agent reports it's done:

```
> /ship-feature
```

This runs TypeScript check → deploys preview backend → rebases onto main → verifies tests → writes `review.md` → runs compound (extracts new pitfalls/patterns) → posts to Linear → opens PR → closes the issue.

### 7f. Merge

CI runs on the PR. If green, merge. The agent's worktree can be torn down with `Ctrl+X Ctrl+X` in Agent View.

---

## Step 8 — Scale up

Once the single-agent loop works, try a batch:

```bash
tools/dispatch-batch.sh ACM-2 ACM-3 ACM-4
```

Each issue gets its own background session, its own worktree, its own preview. Monitor:

```bash
claude agents
```

Burn-down rhythm:

1. **Phase 1 — Foundations.** Pick 3–5 unblocked issues from different parts of the codebase. Dispatch in parallel.
2. **Review and merge** as PRs land. CI is the gate.
3. **Phase 2 — Dependents.** Dispatch the second tier (issues whose blockers are now merged).
4. **Repeat.**

`dispatch-batch.sh` checks Linear `blockedBy` relations before firing and refuses to dispatch dependent issues whose blockers haven't merged. Use `--force` to override (rarely needed).

---

## Step 9 — Make the framework smarter over time

Every `/ship-feature` run writes `compound.md` which extracts:

- New **pitfalls** (failure modes the next agent should avoid) → `ai/knowledge/pitfalls/<slug>.md`
- New **patterns** (approaches worth reusing) → `ai/knowledge/patterns/<slug>.md`
- Promoted **standards** (rules now general enough for STANDARDS.md)
- New **ADRs** (architectural decisions) → `ai/knowledge/decisions/<slug>.md`

Don't skip the compound step. It is the difference between a system that gets worse as it scales and one that gets better.

---

## Where to go next

- **Conceptual deep-dive:** [docs/01-concepts.md](./docs/01-concepts.md)
- **The workflow loop in detail:** [docs/02-workflow-loop.md](./docs/02-workflow-loop.md)
- **Parallel agents:** [docs/03-parallel-agents.md](./docs/03-parallel-agents.md)
- **Customizing for your stack:** [docs/08-customizing.md](./docs/08-customizing.md)
- **Real-world example:** [examples/paul9.md](./examples/paul9.md)
- **Troubleshooting:** [docs/09-troubleshooting.md](./docs/09-troubleshooting.md)

---

## Getting help

- **Issues / bug reports:** https://github.com/renewisepunk/wisepunk-agentic-engineering-framework-v2/issues
- **Pull requests welcome** — especially per-stack `bootstrap-worktree-backend.sh` examples
