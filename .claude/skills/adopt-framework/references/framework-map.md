# Framework Map

Everything the installer writes into a target repo, and what each piece is for. This map replaces reviewing the framework repo.

## Installed layout

```
your-repo/
  AGENTS.md                  Project instructions every agent loads first. Describes the loop,
                             the skills, parallel-work rules, and run-record conventions.
                             Has a "Stack-specific reminders" section for per-project additions.
  CLAUDE.md                  One line: `@AGENTS.md` — re-exports AGENTS.md for Claude Code.

  ai/                        The AI-readable substrate. Authored, never generated.
    CONTEXT.md               Project brief: what/who/architecture/stack/environments/constraints.
                             Every agent reads this first. (Installer renames CONTEXT.template.md.)
    STANDARDS.md             Engineering rules enforced at review: error handling, testing,
                             security, performance, docs, and the Three-Surface Rule.
    README.md                Explains the ai/ folder itself and the agent read order.
    workflows/               The four-step loop, one file per step:
      plan.md                  request → concrete plan
      work.md                  plan → implementation + worklog
      review.md                implementation → findings
      compound.md              findings → pitfalls/patterns/ADRs/standards
    templates/
      plan.md                Plan skeleton /new-feature fills in (Linear field, user value,
                             scope, Three-Surface table, efficiency budget, test plan, gates).
    checklists/              Pre-merge gates, checked by skills:
      plan.md  review.md  ai-first.md  security.md  efficiency.md  user-value.md
    knowledge/               Compounding memory. ONE FILE PER ITEM (avoids merge conflicts):
      pitfalls/              One file per known failure mode.
      patterns/              One file per reusable approach.
      decisions/             ADRs for significant architectural decisions.
      test-patterns/         How tests are structured in this project.
    eval-suites/             JSONL eval cases for quality-graded surfaces (search, ranking,
                             AI outputs). One file per feature; rarely needed.
    gates.config.mjs         Config for the gate classifier (which validations apply to a diff).
    runs/                    Created on demand. Per-feature audit trail:
                             YYYY-MM-DD_<ISSUE>_<slug>/{plan,worklog,review,compound}.md

  .claude/skills/            Native Claude Code skills (see table below).

  tools/                     Orchestration scripts (see table below).

  .githooks/
    pre-push                 Merge gate: blocks direct pushes to main, lints changed files.
    pre-commit               Light pre-commit checks.
    post-merge, post-rewrite Dep-drift reminders after pulling main (never block).

  .github/workflows/ci.yml   Type-check + lint CI template. Merge into existing CI if present.
```

## Knowledge-file frontmatter

Every file in `ai/knowledge/pitfalls/` and `patterns/` starts with:

```yaml
---
title: "<short human-readable title>"
tags: [kebab-tag1, kebab-tag2]      # from the filename slug, max 8
related: [other-file.md]
created: YYYY-MM-DD
last_referenced: YYYY-MM-DD | null  # bumped when an agent reads it during planning
---
```

Pitfall body shape: **Symptom / Root cause / How to recognize this / Fix / Where this affects us.**
Filenames are specific kebab-case slugs (`convex-preview-key-distinct-from-dev-key.md`, never `bug-1.md`).
`tools/migrate-knowledge-frontmatter.mjs` backfills frontmatter on files missing it.

## The loop

```
Linear ACM-42                 ← human (or coordinator agent) picks an issue
  /new-feature ACM-42         ← claims issue (assignee lock), creates run folder,
                                writes plan.md, scaffolds acceptance spec, STOPS for plan review
  "Proceed per the plan."     ← agent implements, tests alongside code, keeps worklog.md
  /ship-feature               ← static checks → preview deploy → rebase → tests →
                                gate-scoped reviews → review.md → compound → PR → Linear closed
  human merges                ← CI is the gate
```

## Skills (installed at `.claude/skills/`)

| Skill | What it does |
|---|---|
| `/new-feature <ID>` | Fetches + claims the Linear issue, checks for duplicate work on main, bootstraps backend isolation in agent worktrees, reads context/pitfalls/patterns, writes `plan.md` (scope discipline, Three-Surface table, user value, efficiency budget, test plan, gate scope), scaffolds the acceptance spec, posts the plan to Linear. Does NOT start coding. |
| `/ship-feature` | Classifies which gates the diff triggers, runs them (acceptance, user-value walkthrough, security, efficiency, evals), writes `review.md`, runs compound, opens the PR, posts to Linear, closes the issue. |
| `/independent-review` | Fresh agent re-reviews the branch with no implementer context. |
| `/security-review` | Security-lens review of the current branch. |
| `/efficiency-review` | Efficiency-lens review (queries, N+1, bundle, hot paths) against the plan's budget. |

## Tools (installed at `tools/`)

| Tool | Use |
|---|---|
| `linear-cli.mjs` | Linear wrapper used by all skills: `get`, `list`, `claim` (race-safe), `comment`, … Reads `LINEAR_API_KEY` from `.env.local`; works in background sessions (no MCP dependency). |
| `install.sh` | This framework's installer. `--team --prefix --target --yes` for non-interactive runs. |
| `spawn-agent.sh` | Manual worktree bootstrap for one issue. |
| `dispatch-batch.sh` | Fire N parallel background agents, one per issue; refuses issues whose Linear blockers haven't merged. |
| `agent-status.sh` | Fleet view + cleanup helpers. |
| `cleanup-merged.sh` | Removes worktrees whose branch has no open PR (`--dry-run` to preview). |
| `bootstrap-worktree-backend.sh` | Per-worktree backend isolation hook. Ships as a port-allocating stub; customize per stack before parallel work. |
| `setup-hooks.sh` | Points `core.hooksPath` at `.githooks/`. Skip if the repo uses husky etc. |
| `post-pull.sh` | On-demand dep-drift check after pulling main. |
| `gate-classifier.mjs` / `gates.config.mjs` | Decide which validation gates a diff triggers (used by `/ship-feature`). |
| `eval-runner.mjs` | Runs `ai/eval-suites/*.jsonl` cases. |
| `knowledge-usage.mjs` | Reports which pitfalls/patterns are actually being read. |
| `migrate-knowledge-frontmatter.mjs` | Backfills frontmatter on knowledge files. |

## Read order for a new agent in an adopted repo

1. `AGENTS.md` (loaded automatically)
2. `ai/CONTEXT.md`
3. `ai/STANDARDS.md`
4. `ai/knowledge/pitfalls/` — list, skim relevant
5. `ai/knowledge/patterns/` — list, skim relevant
6. The workflow file for the current step (or just use the skills, which encode this order)

## Deep-dive docs (framework repo, human-paced — not needed for adoption)

`docs/01-concepts.md` (mental model) · `02-workflow-loop.md` · `03-parallel-agents.md` ·
`04-skills.md` · `05-knowledge-compounding.md` · `06-testing-and-ci.md` ·
`07-linear-integration.md` · `08-customizing.md` (per-stack recipes) · `09-troubleshooting.md` ·
`examples/paul9.md` (full Convex reference) · `examples/minimal.md` (smallest viable setup)
