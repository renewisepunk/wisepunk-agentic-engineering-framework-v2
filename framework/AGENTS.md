# Agentic Engineering Framework

This project uses a Markdown-native workflow system for AI-assisted development, supporting multiple Claude Code agents working on Linear issues in parallel.

## Before starting any task

1. Read `ai/CONTEXT.md` to understand the project.
2. Read `ai/STANDARDS.md` for engineering conventions.
3. Check `ai/knowledge/pitfalls/` for known failure modes (one file per pitfall).

## Skills (preferred entry points)

For new features, use these skills instead of invoking the workflows manually:

- **`/new-feature {ISSUE_PREFIX}-XXX`** — Start a new feature. Claims the Linear issue (assignee lock), bootstraps backend isolation if running in an agent worktree, creates the run folder (`ai/runs/YYYY-MM-DD_{ISSUE_PREFIX}-XXX_name/`), and writes `plan.md` with the Three-Surface table and test plan. Do not start coding before this is done.
- **`/ship-feature`** — Run after implementation is complete. Runs static checks, deploys backend preview, verifies tests, writes `review.md`, runs compound, opens a PR, posts results to Linear, and closes the issue.
- **`/independent-review`** (optional) — Second-pass review by a fresh agent with no implementer context. Recommended for every PR.

## Parallel work — burn down the backlog

Several Claude Code agents can work on independent Linear issues at the same time, each in its own git worktree with its own preview backend and dev port. The full operating model is in the framework docs under `docs/03-parallel-agents.md`.

### One issue at a time

```bash
claude agents                                      # open Agent View
> /new-feature {ISSUE_PREFIX}-86                   # dispatch as a background session
                                                   # (Claude auto-creates the worktree; the skill does the rest)
```

### Many issues in one go

```bash
tools/dispatch-batch.sh {ISSUE_PREFIX}-74 {ISSUE_PREFIX}-83 {ISSUE_PREFIX}-90
# spawns one background session per issue, all running in parallel
claude agents                                      # monitor: see what each is doing, attach when one needs you
```

### Strategy for burning down a large backlog

Issues with `blockedBy` relations in Linear should NOT be dispatched until their blockers merge — the dependent agents would otherwise build against unmerged code. The natural rhythm:

1. **Phase 1 — Foundations.** Identify the foundation issue in each project (the one others depend on). Dispatch these in parallel.
2. **Review and merge** as each foundation PR comes in (CI is the gate).
3. **Phase 2 — Dependents.** Dispatch the second tier (issues whose blockers are now merged).
4. **Repeat** until the project is drained.

Watch the meters: each background session consumes Claude subscription quota independently, and each preview deployment counts against your backend's slot quota. Don't dispatch 30 agents at once unless you're prepared to pay.

## Core workflow loop

The skills above call these workflows internally. Run them directly only when doing non-feature work (bug fixes, spikes, doc updates).

1. **Plan** — `ai/workflows/plan.md` — Turn a request into a concrete plan.
2. **Work** — `ai/workflows/work.md` — Implement the plan.
3. **Review** — `ai/workflows/review.md` — Assess the implementation.
4. **Compound** — `ai/workflows/compound.md` — Extract learnings back into the system.

## Run records

Every feature gets a run folder. Name it with the Linear issue ID:

```
ai/runs/YYYY-MM-DD_{ISSUE_PREFIX}-XXX_short-name/
  plan.md
  worklog.md
  review.md
  compound.md
```

Use the template in `ai/templates/plan.md`. The `Linear:` field at the top is required.

## Rules

- Follow `ai/STANDARDS.md` for all code.
- Check relevant checklists in `ai/checklists/` before marking work as done.
- After every completed task, run the compound workflow to capture learnings.
- Do not skip the compound step. It is what makes the system improve over time.
- Always commit after major changes. Push goes via PR — `main` is gated by CI and the pre-push hook (`.githooks/pre-push`).

## Stack-specific reminders

<!--
Add reminders here for things agents tend to forget for your stack. Examples:

- After any change to `kernel/` files, redeploy: `tools/deploy-kernel.sh`. Auto-detects branch slug.
- Schema migrations: run `npx convex dev --once` after editing `convex/schema.ts`.
- Always update `ai/knowledge/actions.md` when adding a new operation.
-->
