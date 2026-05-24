# Wisepunk Agentic Engineering Framework

A Markdown-native operating system for building software with a fleet of AI coding agents working in parallel.

> The framework that lets one human direct 5–30 Claude Code agents at once — each on its own Linear issue, in its own isolated worktree, with its own preview backend — and ship product to production every day.

## What this is

A drop-in `ai/` + `.agents/` + `tools/` layer that turns any project into one a fleet of Claude Code agents can build. It gives you:

- **A four-step loop** — `plan → work → review → compound` — that every feature flows through.
- **Skills** — `/new-feature` and `/ship-feature` — that wrap the loop so an agent runs the whole pipeline from a single command.
- **Parallel-agent isolation** — git worktrees + per-branch preview backends + per-branch ports, so 30 agents can be in flight without colliding.
- **Linear as the work queue** — `assignee` field is the lock; race-safe claim-before-work.
- **Compounding knowledge** — pitfalls and patterns extracted after every feature, so the next agent (or the same one tomorrow) starts smarter.
- **Three-Surface Rule** — every user-facing capability must be reachable from UI, AI chat, and CLI/HTTP. Enforced by the plan template and review checklist.

It is **markdown-first**. Every workflow, skill, standard, pitfall, and pattern is a plain `.md` file in your repo. No SaaS, no lock-in. Git tracks it; humans and agents read the same files.

## Who this is for

- Solo founders or small teams who want to ship at fleet-scale without hiring a fleet.
- Engineering teams that already use Linear and want a standardized way to direct Claude Code agents.
- Anyone running into the limits of single-agent workflows ("the agent's good but I can only steer one at a time").

## Quick start

```bash
# In your existing project
git clone https://github.com/renewisepunk/wisepunk-agentic-engineering-framework /tmp/waef
bash /tmp/waef/framework/tools/install.sh

# Then fill in the placeholders the installer surfaces:
#   - ai/CONTEXT.md (what your project is)
#   - ai/STANDARDS.md (rules to enforce)
#   - .env.local LINEAR_API_KEY (get one from linear.app/settings/account/security)
```

Full step-by-step in [GETTING_STARTED.md](./GETTING_STARTED.md).

## How it works (in 60 seconds)

```
Linear PAU-42                      ← human picks an issue
   ↓
claude agents                      ← open Claude Code's Agent View
> /new-feature PAU-42              ← skill claims the issue, bootstraps a worktree,
                                     writes ai/runs/<date>_PAU-42_name/plan.md
   ↓
agent implements                   ← reads plan + pitfalls, writes code + tests,
                                     keeps worklog.md
   ↓
> /ship-feature                    ← skill runs tsc, deploys preview backend,
                                     rebases on main, verifies tests, writes
                                     review.md, runs compound (writes new
                                     pitfalls/patterns), opens PR, closes Linear
   ↓
human merges                       ← CI is the gate
   ↓
Ctrl+X Ctrl+X                      ← Agent View tears down the worktree
```

Run that loop 10× a day across 10 parallel agents and your backlog drains itself.

## What's in this repo

```
README.md                  ← you are here
GETTING_STARTED.md         ← install + first feature, end to end

docs/                      ← conceptual + how-to docs
  01-concepts.md             the mental model — three-surface, compound, parallel
  02-workflow-loop.md        plan / work / review / compound in depth
  03-parallel-agents.md      how dozens of agents stay out of each other's way
  04-skills.md               /new-feature, /ship-feature, /independent-review
  05-knowledge-compounding.md  pitfalls + patterns + how they feed back in
  06-testing-and-ci.md       smoke suites, CI gates, the pre-push hook
  07-linear-integration.md   how Linear becomes the work queue
  08-customizing.md          adapting the framework to your stack
  09-troubleshooting.md      common failure modes

framework/                 ← the portable substrate (copied into your project)
  AGENTS.md                  project-instruction template
  CLAUDE.md                  Claude Code's entry point (re-exports AGENTS.md)
  ai/                        the canonical ai/ folder
    README.md
    CONTEXT.template.md
    STANDARDS.md
    workflows/{plan,work,review,compound}.md
    templates/plan.md
    checklists/{plan,review,ai-first}.md
    knowledge/{pitfalls,patterns,decisions}/README.md
  .agents/skills/{new-feature,ship-feature,independent-review}/SKILL.md
  tools/                     orchestration scripts
    install.sh                 → run once per project to set everything up
    linear-cli.mjs             → Linear API wrapper that works in background sessions
    spawn-agent.sh             → manual worktree bootstrap
    bootstrap-worktree-backend.sh  → backend-isolation hook (override per stack)
    dispatch-batch.sh          → fire N parallel agents at once
    agent-status.sh            → fleet view + cleanup
    setup-hooks.sh             → install the pre-push merge gate
  .githooks/pre-push
  .github/workflows/ci.template.yml

examples/                  ← real-world references
  paul9.md                   how Paul9 (a GTM AI product) uses this framework
  minimal.md                 smallest viable setup, no Linear, no preview backend
```

## Why "Wisepunk"

[Wisepunk](https://www.wisepunk.com) is the studio building this framework, alongside [Paul9](https://www.paul9.com) — the agentic GTM product the framework was extracted from. The framework shipped 40+ PRs in 8 days while a single human directed traffic. We open-sourced it so you can do the same.

## License

MIT. Use it, fork it, sell it, ignore us. If you find it useful, let us know — we're [@renewisepunk](https://github.com/renewisepunk) on GitHub.

## Status

**v0.1** — extracted from Paul9 in May 2026. The skills, workflows, and Linear integration are battle-tested at fleet scale. The portable installer and per-stack backend hooks are newer; expect rough edges. PRs and issues welcome.
