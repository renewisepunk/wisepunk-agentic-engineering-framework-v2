# Example: Minimal Setup

The smallest viable installation of the framework. For early-stage projects, single-agent workflows, or trying the loop without committing to the full setup.

---

## What this gives you

- The four-step loop (plan → work → review → compound)
- The `/new-feature` and `/ship-feature` skills
- Linear integration as the work queue
- Compounding knowledge (pitfalls + patterns)
- CI with type-check + lint

## What this skips

- Per-worktree preview backends (you share one dev backend across agents)
- Parallel-agent batch dispatch
- Independent reviewer
- UI smoke suite

You can add any of these later. Start small.

---

## Setup

### 1. Install

```bash
cd your-project
git clone https://github.com/renewisepunk/wisepunk-agentic-engineering-framework /tmp/waef
bash /tmp/waef/framework/tools/install.sh
```

When prompted:
- Team name: your Linear team (e.g. `Acme`)
- Issue prefix: e.g. `ACM`

### 2. Linear key

```bash
echo "LINEAR_API_KEY=lin_api_xxxxx" >> .env.local
```

### 3. Pre-push hook

```bash
bash tools/setup-hooks.sh
```

### 4. Fill in CONTEXT.md

Edit `ai/CONTEXT.md` — one paragraph on what your project is, the stack, the deploy command. That's enough to start.

### 5. Decide: STANDARDS

Open `ai/STANDARDS.md`. The shipped version has the Three-Surface Rule prominently. If your project has no AI chat or CLI, **delete the Three-Surface section** — it'll confuse the planning step.

The other sections (error handling, testing, security, etc.) are general; keep them.

---

## What you don't have to do

- **Don't customize `bootstrap-worktree-backend.sh`.** The stub allocates a port and writes env vars; that's enough for single-agent work. Add backend isolation only when you start using `spawn-agent.sh` or `dispatch-batch.sh` for real.

- **Don't enable the independent reviewer.** Self-review is fine for early-stage. Add `/independent-review` when you're shipping to real users.

- **Don't worry about per-file chat tools / HTTP routes.** Until you have ~5 concurrent agents, mega-files don't conflict often enough to matter.

---

## The flow, simplified

```bash
# 1. Pick an issue in Linear (e.g. ACM-1)

# 2. Spawn an agent on it (single session, in your main worktree)
claude
> /new-feature ACM-1

# 3. Review the plan in ai/runs/<date>_ACM-1_<slug>/plan.md
#    Edit if anything's off.

# 4. Let the agent implement
> Proceed with implementation per the plan.

# 5. Ship
> /ship-feature

# 6. Merge the PR
gh pr merge --auto
```

No worktrees, no preview backends, no parallel agents. Just the loop.

---

## When to graduate

Move to the full setup when:

- You want to run >1 agent at a time (need worktrees + isolation)
- Your backend supports preview deployments (Convex, Supabase, Neon, Vercel)
- You're starting to see merge conflicts in shared files
- You want CI to gate merges with real tests (not just type-check)

The framework's other docs cover each step. See [GETTING_STARTED.md](../GETTING_STARTED.md) for the full setup, [docs/08-customizing.md](../docs/08-customizing.md) for stack-specific recipes.

---

## Why start minimal

Pricing your own attention realistically: the full framework pays off when you have a backlog larger than what you alone can ship. Until you're there, the extra ceremony isn't earning its keep. Start with the loop; add the parallel-agent scaffolding when you outgrow single-agent work.

The compound step matters from day 1, though. Don't skip it even when you're solo. The pitfalls you write today are the time your future self saves tomorrow.
