# 01 — Concepts

The mental model behind the framework. Read this first; everything else is mechanics.

---

## The thesis

A modern engineering team's bottleneck isn't writing code — it's **deciding what to write, keeping work coordinated, and accumulating institutional knowledge**. Coding agents are very good at the first part and terrible at the other two, by default.

This framework makes them good at the other two by giving them:

1. **A shared work queue** (Linear) where every task is a discrete issue.
2. **A predictable workflow** (plan → work → review → compound) that every task flows through.
3. **Isolated execution** (git worktrees + preview backends) so many tasks can be in flight without colliding.
4. **A persistent memory** (pitfalls + patterns) that compounds with every shipped feature.

The result: a fleet of agents that you can direct like a small team, where each agent gets sharper as the codebase grows instead of duller.

---

## Five concepts you have to internalize

### 1. The four-step loop

Every piece of work — feature, bug fix, refactor — flows through:

```
plan  →  work  →  review  →  compound
```

| Step | What happens | Where it lives |
|---|---|---|
| **Plan** | Turn a request into a concrete plan with testable acceptance criteria | `ai/workflows/plan.md` → produces `ai/runs/<run>/plan.md` |
| **Work** | Implement the plan; write tests alongside; log decisions | `ai/workflows/work.md` → produces `worklog.md` |
| **Review** | Assess against acceptance criteria, security, performance, tests | `ai/workflows/review.md` → produces `review.md` |
| **Compound** | Extract learnings; write pitfalls, patterns, standards, ADRs | `ai/workflows/compound.md` → produces `compound.md` + edits to `ai/knowledge/` |

The compound step is the one most teams skip. **It is the whole point of the system.** Without it, you have a checklist. With it, you have something that gets better over time.

### 2. The Three-Surface Rule

> Every user-facing capability must be reachable from three surfaces: **UI**, **AI chat**, and **CLI / HTTP**.

| Surface | Where the code lives |
|---|---|
| **UI** | React (or whatever your frontend is) → backend function |
| **AI chat** | A tool registered with your chat agent → service function |
| **CLI / HTTP** | An HTTP route → service function |

**Canonical logic lives once**, in a service function (e.g. `lib/actions/<name>.ts` or a backend mutation). The three surfaces are thin wrappers — they validate inputs and call the service.

Why this matters:

- **Legibility for agents** — when every capability lives in three predictable places, an agent can find and modify it without exploration.
- **Composability** — capabilities that are CLI-addressable can be composed by other agents, scheduled, scripted.
- **User experience** — different users prefer different surfaces. Don't force them.

**Exemptions:** schemas, helpers, internal plumbing. State this explicitly in the plan ("schema-only; Three-Surface does not apply") and skip the table.

### 3. Linear as the work queue and the lock

Linear is the single source of truth for:

- **What's in scope** — the issue title + description is the work order. Agents implement what the issue says, no more.
- **Who owns it** — the `assignee` field is the lock. Two agents can't claim the same issue.
- **Status** — `Backlog → In Progress → Done`. Skills move it.
- **Dependencies** — `blockedBy` relations gate dispatch order.

The framework reads and writes Linear via `tools/linear-cli.mjs` — a small REST/GraphQL wrapper that works in background sessions (unlike most MCP servers).

### 4. Parallel agents with isolation

A single human can direct many agents at once if each agent has:

| Resource | Per-agent? | How |
|---|---|---|
| Git branch | yes | One worktree per issue |
| Working tree | yes | `.claude/worktrees/<name>/` |
| Backend (database, queue) | yes | Preview deployment per worktree |
| Dev server port | yes | `3000 + hash(branch) % 100` |
| Issue ownership | yes | Linear assignee lock |

Without this isolation, agents step on each other constantly. With it, dispatching 10 agents is no more risky than dispatching 1.

The framework provides `tools/spawn-agent.sh` and `tools/bootstrap-worktree-backend.sh` for setup, plus `tools/agent-status.sh` for monitoring.

### 5. Compounding knowledge

After every feature, the compound step extracts:

- **Pitfalls** (`ai/knowledge/pitfalls/<slug>.md`) — failure modes the next agent should avoid. One file per pitfall (avoids merge conflicts when parallel agents compound simultaneously).
- **Patterns** (`ai/knowledge/patterns/<slug>.md`) — approaches worth reusing.
- **Standards updates** (`ai/STANDARDS.md`) — when a class of bug suggests a missing rule.
- **ADRs** (`ai/knowledge/decisions/<slug>.md`) — significant architectural decisions.

`/new-feature` reads pitfalls and patterns before planning. The next agent starts with everything previous agents learned.

This is the difference between "10 agents shipping 10 features" and "10 agents shipping 10 features and making each other smarter."

---

## What the framework is NOT

- **Not a CI/CD system.** It assumes you have GitHub Actions (or similar) and integrates with it. It doesn't replace it.
- **Not a project management tool.** Linear is the queue; the framework consumes it.
- **Not a chat interface for code.** Claude Code is the runtime; the framework is the scaffolding that runs inside it.
- **Not magic.** Agents still make mistakes. The framework makes mistakes recoverable (small PRs, isolated backends, CI gate, independent review) rather than preventing them.

---

## When this framework is overkill

- **Solo prototyping** where you're the only one working and exploration matters more than discipline. Use Claude Code directly; reach for this when you start shipping to real users.
- **Tiny apps** where you'll never want >1 agent at once. The single-agent flow still works but the parallel scaffolding is unused.
- **Teams without Linear.** The framework hardcodes Linear as the queue. Switching to GitHub Issues / Jira / Notion is doable but requires rewriting `linear-cli.mjs`. PRs welcome.

---

## When this framework is essential

- **A backlog larger than what one human can ship.** Parallel agents are the unlock; isolation is the precondition.
- **A codebase that's outgrown "I remember why we did that."** Compounding knowledge becomes the team's memory.
- **A product where every feature touches multiple surfaces** (UI + API + automation). Three-Surface enforcement keeps it consistent.

---

## Next

- **The loop in detail:** [02-workflow-loop.md](./02-workflow-loop.md)
- **Parallel agents:** [03-parallel-agents.md](./03-parallel-agents.md)
