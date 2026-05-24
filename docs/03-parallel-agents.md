# 03 — Parallel Agents

How to run 5–30 Claude Code agents simultaneously on the same codebase without them stepping on each other.

This is the operationally novel part of the framework. If you only run one agent at a time, you can skip most of this — but the same primitives still apply.

---

## The isolation matrix

Each agent gets its own everything. Anything *shared* across agents must be coordinated through a lock (Linear assignee) or designed for concurrency (the codegen merge resolver).

| Resource | Per-agent? | How it's isolated |
|---|---|---|
| **Git branch** | yes | One branch per worktree, auto-named or `agent/<ISSUE>-<slug>` |
| **Working tree** | yes | `.claude/worktrees/<name>/` (git worktree) |
| **Backend (DB, queue, etc.)** | yes | Preview deployment per worktree |
| **Dev server port** | yes | `3000 + hash(branch) % 100` (deterministic, no collisions for ~99 simultaneous agents) |
| **External service apps** (Kernel, Edge functions, etc.) | yes | Per-branch app name |
| **`.env.local`** | per-worktree | Same secrets, per-branch overrides appended |
| **`node_modules`** | shared | pnpm store dedupes; safe |
| **Linear issue** | locked | Assignee field — race-safe claim-before-work |

---

## Three dispatch modes

### A. Agent View (primary)

Claude Code 2.1.139+ ships **Agent View**: one screen showing every background session, state icons, peek panel, PR status, keyboard shortcuts.

```bash
claude agents                    # open Agent View
> /new-feature ACM-42            # dispatches as a background session
```

What Claude does behind the scenes:
1. Auto-creates a worktree at `.claude/worktrees/<auto-name>/`
2. Spawns a new background session inside it
3. The session runs `/new-feature ACM-42` which claims, bootstraps backend, writes plan

This is the default. Use it.

### B. Batch dispatch

For draining a tier of unblocked issues at once:

```bash
tools/dispatch-batch.sh ACM-42 ACM-43 ACM-44 ACM-45
```

One background session per issue, all in parallel. The script does a pre-flight check for `blockedBy` relations within the batch and refuses dependent dispatches (use `--force` to override).

### C. Manual spawn

For non-interactive scripting:

```bash
tools/spawn-agent.sh --issue ACM-42 --slug add-schedules
cd .claude/worktrees/ACM-42-add-schedules
pnpm install   # or your install command
claude         # then in the session: /new-feature ACM-42
```

This creates an explicit `agent/ACM-42-add-schedules` branch (vs. Agent View's auto-generated names). The skill detects existing bootstrap and skips duplicate work.

---

## The bootstrap script

`tools/bootstrap-worktree-backend.sh` is the per-stack hook. It:

1. Detects the slug (from issue title or `--slug` flag).
2. Validates required env keys are present (`LINEAR_API_KEY`, backend deploy key, etc.).
3. Allocates a unique dev port (`3000 + hash(branch) % 100`).
4. Creates a preview deployment (Convex / Supabase / etc.).
5. Writes per-branch values into the worktree's `.env.local`:
   - `AGENTIC_BRANCH_SLUG=<slug>`
   - `AGENTIC_DEV_PORT=<port>`
   - Backend connection string overrides

The script that ships is a **stub** — it does steps 1–3 but leaves step 4 (preview creation) for you to fill in based on your stack. See [docs/08-customizing.md](./08-customizing.md) for stack-specific recipes.

---

## Linear as the lock

Two agents can't both pick `ACM-42`. The `/new-feature` skill enforces this via a race-safe claim sequence:

```
1. Read issue.assignee
2. If assigned to another email → ABORT (exit 2)
3. Set assignee = me
4. Re-read issue.assignee
5. If not me → ABORT (race lost, exit 2)
```

Implemented in `tools/linear-cli.mjs claim`. The re-read step matters: between (1) and (3), another agent might also have read+written. The re-read catches the loser of the race.

---

## Coordinating shared files

Some files are touched by almost every feature: the chat tools registry, the HTTP routes registry, the database schema, generated codegen. Two agents editing these will conflict.

Two strategies:

### Strategy 1 — Split the mega-file

Convert "one file edited by everyone" into "one file per feature, auto-aggregating index." Then adding a tool means creating `tools/<name>.ts`, never editing the index. No conflicts.

This is the right long-term answer. See [docs/08-customizing.md#mega-file-split](./08-customizing.md#mega-file-split) for patterns.

### Strategy 2 — Resolve at rebase time

When the second PR rebases onto main, conflicts in the mega-file are predictable and resolvable:

- **Codegen conflicts** — auto-resolvable. The framework ships `tools/resolve-codegen-conflict.sh` as a starting point (you'll likely need to adapt it per stack).
- **Schema / route / tool registry conflicts** — manual but additive (keep both PRs' additions, drop nothing).

The `/ship-feature` skill rebases onto main *before* opening the PR (Step 2.5), so conflicts are resolved while the implementing agent still has full context — not later, by a human merging.

---

## Burn-down rhythm

The natural cadence for a large backlog:

```
1. Identify foundation issues
   ├── usually marked "no blockedBy"
   └── often schema-only or "platform" issues that others depend on

2. Dispatch foundations in parallel
   tools/dispatch-batch.sh ACM-90 ACM-83 ACM-74

3. Review and merge as PRs land
   ├── CI is the gate
   └── independent reviewer agent (if enabled) is the second gate

4. Dispatch dependents
   ├── re-check Linear for issues whose blockers are now merged
   └── dispatch the next tier

5. Repeat until backlog drained.
```

Watch the meters:

- Each background session consumes Claude subscription quota independently.
- Each preview deployment counts against your backend's preview slot quota.
- Don't dispatch 30 agents at once unless you're prepared to pay.

Sane defaults: 3–5 in parallel for steady throughput; 10+ only for a focused push.

---

## Monitoring

**Live state:**
```bash
claude agents
```
What each agent is doing, PR status, "needs input" group, peek panel, attach/detach.

**On-disk fleet:**
```bash
tools/agent-status.sh
```
Branches, ports, dev-server bound/not, last commit. Useful for "what's on this machine" rather than "what's each agent thinking."

---

## Cleanup

**Per-agent:**

```bash
# In Agent View — removes session + worktree + branch (after PR merged or pushed)
Ctrl+X Ctrl+X

# Or for spawn-agent.sh worktrees:
tools/agent-status.sh --cleanup ACM-42-add-schedules
```

**Preview deployments:** most backends auto-expire previews after a few days. The Convex CLI has no delete subcommand; the framework documents this and leaves them to expire. Adapt for your stack.

**External apps (Kernel, Edge, etc.):** if your stack creates apps per branch, they're typically harmless to leave (nothing invokes them after the worktree is gone). Add a manual cleanup step in your bootstrap script if needed.

---

## Common failure modes

- **`PAUL9_*` env vars hardcoded.** This framework's reference implementation came from Paul9. Generalize to `AGENTIC_*` (or your own prefix) when adapting bootstrap scripts.
- **Mega-file conflicts.** Until the split lands, expect them. The rebase-before-PR step makes them recoverable.
- **Claim races.** If you see "Race lost: issue is now assigned to X," that's the lock working — try another issue.
- **Backend preview slot exhaustion.** Most backends cap concurrent previews on the free tier. Either upgrade or sequence harder.
- **Background sessions stuck on permission prompts.** Use `--permission-mode auto` (the dispatch-batch script does this by default). Risky operations still pause for attention via Agent View's "Needs input" group.

---

## Next

- **The skills that drive the loop:** [04-skills.md](./04-skills.md)
- **Customizing for your backend:** [08-customizing.md](./08-customizing.md)
