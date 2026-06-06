---
name: adopt-framework
description: This skill should be used when an agent or user asks to "integrate this framework", "install the framework", "adopt the agentic engineering framework", "set up the framework in my repo", "onboard this repo to the framework", or "get started with the framework" — especially into an existing repo that already has docs, plans, a CLAUDE.md, its own tools/, or CI. Installs the framework into a target repo non-interactively and migrates existing markdown content into the ai/ structure.
---

# Adopt the Wisepunk Agentic Engineering Framework

This skill takes a target repo from "no framework" to "first `/new-feature` ready" without requiring a review of the framework repo. Everything needed is in this file and its two references.

## The framework in 60 seconds

A Markdown-native operating system for directing a fleet of Claude Code agents:

- **Four-step loop** — `plan → work → review → compound` — every feature flows through it. Workflows live in `ai/workflows/`.
- **Skills** — `/new-feature <ISSUE-ID>` plans and claims an issue; `/ship-feature` validates, reviews, compounds, opens the PR. Plus `/independent-review`, `/security-review`, `/efficiency-review`.
- **Parallel isolation** — git worktrees + per-branch preview backends + per-branch ports so many agents run at once.
- **Linear is the work queue** — `tools/linear-cli.mjs` wraps the API; the assignee field is a race-safe lock.
- **Compounding knowledge** — after every feature, pitfalls/patterns/ADRs are extracted into `ai/knowledge/` so the next agent starts smarter.
- **Three-Surface Rule** — every user-facing capability reachable from UI, AI chat, and CLI/HTTP.

For the file-by-file map of everything the installer writes, read `references/framework-map.md`. Do **not** crawl the framework repo's `docs/` — they are human deep-dives; the map covers what an integrating agent needs.

## Inputs to collect first

1. **Framework source** — a local clone of this repo. If not present:
   ```bash
   git clone https://github.com/renewisepunk/wisepunk-agentic-engineering-framework-v2 /tmp/waef
   ```
2. **Target repo path** — the project being onboarded. Must be a git repo (the installer warns otherwise).
3. **Linear team name and issue prefix** (e.g. team `Acme`, prefix `ACM`) — ask the user if unknown. If the project has no Linear workspace, use placeholder values and read "No Linear workspace" in `references/existing-repo-integration.md`.

## Phase 1 — Audit the target repo

Inventory what already exists before writing anything. Record findings; they drive Phase 3.

```bash
cd "$TARGET"
ls AGENTS.md CLAUDE.md 2>/dev/null                # existing agent instructions?
ls -d ai .claude/skills tools .githooks .husky 2>/dev/null
ls .github/workflows/ 2>/dev/null                  # existing CI?
git config core.hooksPath                          # existing hook manager?
```

Then find the existing markdown knowledge base — folders like `docs/`, `notes/`, `plans/`, `planning/`, `specs/`, `adr/`, `decisions/`:

```bash
find . -name '*.md' -not -path './node_modules/*' -not -path './.git/*' | head -50
```

Skim what surfaces and classify each doc: **plan** (describes future/in-flight work), **architecture/context** (describes the system), **conventions** (rules code must follow), **learnings/gotchas**, **ADR/decision**, or **other**. This classification is consumed in Phase 3.

Predict installer conflicts — files that already exist at a destination the installer writes:

```bash
( cd "$FRAMEWORK/framework" && find ai .claude tools .githooks -type f; \
  echo AGENTS.md; echo CLAUDE.md; echo .github/workflows/ci.yml ) | \
while read -r f; do [ -e "$TARGET/$f" ] && echo "CONFLICT: $f"; done
```

## Phase 2 — Install non-interactively

**Critical:** without flags, `install.sh` prompts via `read` for team/prefix and on every file conflict. In a non-interactive agent shell those prompts fail and abort the script. Always pass `--team`, `--prefix`, `--target`, and `--yes` — but `--yes` **overwrites conflicting files without asking**, so protect existing content first:

1. Require a clean working tree so every overwrite is recoverable from git:
   ```bash
   git -C "$TARGET" status --porcelain   # must be empty; commit or stash otherwise
   ```
2. Run the installer:
   ```bash
   bash "$FRAMEWORK/framework/tools/install.sh" \
     --team "Acme" --prefix "ACM" --target "$TARGET" --yes
   ```
3. Review what it overwrote and recover original content for merging:
   ```bash
   git -C "$TARGET" status; git -C "$TARGET" diff   # every CONFLICT file appears here
   git -C "$TARGET" show "HEAD:<path>"               # the pre-install version, when needed
   ```

The installer copies `ai/`, `.claude/skills/`, `tools/`, `.githooks/`, `AGENTS.md`, `CLAUDE.md`, and `.github/workflows/ci.yml`; substitutes `{ISSUE_PREFIX}`/`{TEAM_NAME}` into templates and skills; and renames `ai/CONTEXT.template.md` → `ai/CONTEXT.md` if no `CONTEXT.md` exists.

## Phase 3 — Merge existing content into the framework

Skip this phase entirely for fresh repos. For existing repos, this is the heart of adoption. Full procedures with examples are in `references/existing-repo-integration.md`; the mapping:

| Existing artifact | Destination | How |
|---|---|---|
| `CLAUDE.md` / `AGENTS.md` instructions | `AGENTS.md` → "Stack-specific reminders" section | Merge old content in; keep `CLAUDE.md` as `@AGENTS.md` re-export |
| Active / in-flight plan docs | `ai/runs/<date>_<id>_<slug>/plan.md` | Migrate into the plan template shape |
| Completed / historical plans | Leave in place | Link from `ai/CONTEXT.md` if still informative |
| Architecture / system docs | Leave in place | **Link from `ai/CONTEXT.md` — never duplicate** |
| Conventions / style guides | `ai/STANDARDS.md` | Fold rules in; delete or link the original |
| Gotchas / learnings / "things we learned" | `ai/knowledge/pitfalls/` and `patterns/` | One file per item, with required frontmatter |
| ADRs / decision logs | `ai/knowledge/decisions/` | Move (preserve dates) or leave-and-link |
| Existing CI workflows | Existing workflow stays primary | Port jobs from `ci.yml`; never replace working CI |
| Existing `tools/` scripts | Both coexist | Resolve any name collisions (rare) |
| Husky / existing git hooks | Existing hook manager stays | Port `.githooks/pre-push` logic into it; skip `setup-hooks.sh` |

Two rules govern every row:

- **Link, don't duplicate.** `ai/CONTEXT.md` should be a brief that *points* at existing deep docs, not a copy of them. Duplicated docs drift.
- **One file per knowledge item.** Never append migrated learnings into a shared file — parallel agents merge-conflict on shared files.

## Phase 4 — Configure

1. **Fill `ai/CONTEXT.md` from the codebase — do not leave template placeholders.** Derive real content from the repo's README, package manifests, lockfiles, deploy configs (`vercel.json`, `fly.toml`, `Dockerfile`, …), CI files, and the architecture docs found in Phase 1. Cover: what the project does, users, architecture (link the existing doc), stack with versions, environments + deploy commands, constraints, non-goals. Mark genuinely unknowable items `TODO(human): <question>` and surface them at the end.
2. **Prune `ai/STANDARDS.md`.** Delete sections that don't apply to the stack. If the project has no AI-chat or CLI surface (and none is planned), delete the Three-Surface Rule section — it confuses planning otherwise.
3. **Linear API key** (human step — request it): from linear.app → Settings → Account → Security. Then:
   ```bash
   echo "LINEAR_API_KEY=lin_api_xxxxx" >> "$TARGET/.env.local"
   grep -q '.env.local' "$TARGET/.gitignore" || echo '.env.local' >> "$TARGET/.gitignore"
   ```
4. **Activate the merge gate** — `bash tools/setup-hooks.sh` — *unless* the audit found husky or an existing `core.hooksPath` (see the integration reference for the merge procedure instead).
5. **Defer backend isolation.** `tools/bootstrap-worktree-backend.sh` ships as a port-allocating stub; customizing it for Convex/Supabase/Neon (framework repo `docs/08-customizing.md`) is only needed before running agents in parallel. Note it as a follow-up, don't block on it.

## Phase 5 — Verify and commit

```bash
cd "$TARGET"
grep -rn '{ISSUE_PREFIX}\|{TEAM_NAME}' AGENTS.md ai/ .claude/ 2>/dev/null   # expect no hits
grep -n 'TODO\|<!--' ai/CONTEXT.md                                          # expect only TODO(human) items
node tools/linear-cli.mjs list --team "Acme" --state Backlog --limit 3      # expect JSON (if key set)
ls .claude/skills/                                                          # expect new-feature, ship-feature, …
```

Then stage and commit (e.g. `chore: adopt wisepunk agentic engineering framework`), and report to the user:

1. What was installed and what was merged/migrated (per Phase 3 table)
2. Open `TODO(human)` items from `CONTEXT.md` and any unanswered config (Linear key, backend isolation)
3. The first command to try: open Claude Code in the repo and run `/new-feature <PREFIX>-<n>` on a small issue

## What NOT to do

- Do not run the installer with `--yes` on a dirty working tree — overwrites become unrecoverable.
- Do not replace an existing CI workflow, hook manager, or `CLAUDE.md` wholesale — merge per Phase 3.
- Do not copy existing docs into `ai/` — link them from `CONTEXT.md`.
- Do not start `/new-feature` while `CONTEXT.md` still contains template placeholder comments.
- Do not crawl the framework repo's `docs/` during adoption — `references/framework-map.md` has everything needed; the docs are for humans going deeper later.

## Additional resources

### Reference files

- **`references/framework-map.md`** — file-by-file map of the installed layout, the loop, skills, and tools. Read to answer "what does this framework give the repo" without reviewing the framework repo.
- **`references/existing-repo-integration.md`** — detailed merge/migration playbook: existing CLAUDE.md, plans folders, knowledge docs, CI, hooks, tool collisions, and the no-Linear case.

### In the framework repo (for humans, or when the references don't cover it)

- `GETTING_STARTED.md` — the human-paced version of this flow
- `examples/minimal.md` — smallest viable setup; when to skip parallel-agent scaffolding
- `docs/08-customizing.md` — per-stack backend-isolation recipes (Convex, Supabase, Vercel)
