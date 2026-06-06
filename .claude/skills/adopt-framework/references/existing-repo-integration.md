# Integrating Into an Existing Repo

Detailed procedures for each artifact an existing repo may already have. Run the Phase 1 audit first (SKILL.md); handle only the scenarios that apply.

Two rules govern everything here:

1. **Link, don't duplicate.** `ai/CONTEXT.md` is a brief that points at existing deep docs. A copied doc drifts from its source within weeks.
2. **One file per knowledge item.** Parallel agents merge-conflict on shared files. Never append migrated learnings into one big file.

---

## Scenario 1 — Existing `CLAUDE.md` and/or `AGENTS.md`

The framework's layout: `CLAUDE.md` contains only `@AGENTS.md`; all instructions live in `AGENTS.md`, which ends with a `## Stack-specific reminders` section reserved for per-project content.

**Procedure:**

1. Recover the pre-install instructions: `git show HEAD:CLAUDE.md` (and/or `HEAD:AGENTS.md`).
2. Classify each block of the old content:
   - **Project facts** (what the app is, stack, commands, env setup) → belongs in `ai/CONTEXT.md`.
   - **Coding rules** (style, testing, error handling) → belongs in `ai/STANDARDS.md`, merged into the matching section.
   - **Behavioral instructions for agents** (e.g. "never touch X", "always run Y before committing", tool quirks) → paste under `## Stack-specific reminders` in the new `AGENTS.md`.
3. Keep `CLAUDE.md` as the one-line `@AGENTS.md` re-export. Do not maintain two instruction files.
4. If the old file referenced docs by path (e.g. `see docs/architecture.md`), preserve those links in whichever destination the block landed in.

Anti-pattern: concatenating the entire old CLAUDE.md under the framework's AGENTS.md. The old file almost always mixes facts, rules, and reminders — splitting them into CONTEXT/STANDARDS/AGENTS is what makes each readable.

---

## Scenario 2 — Existing plans / specs folder (`plans/`, `docs/plans/`, `specs/`, `planning/`, …)

Triage each document into one of three buckets:

### 2a. In-flight work (feature being built now or next)

Migrate into a run folder so the loop can pick it up:

1. Create `ai/runs/YYYY-MM-DD_<ISSUE-ID>_<slug>/` (date = migration date; if no Linear issue exists yet, create one — or use a plain slug and note the missing issue as a `TODO(human)`).
2. Copy the old plan's content into `plan.md` reshaped to `ai/templates/plan.md`: add the header fields (`**Linear:**`, `**Status:**`), then map existing content into Problem / User value / Scope / Approach sections. Mark sections the old plan lacks (efficiency budget, gate scope, test plan) as `TODO` — `/new-feature`'s checklist will force them before implementation.
3. Leave a one-line tombstone in the original file: `> Migrated to ai/runs/<folder>/plan.md on YYYY-MM-DD.` Delete the original only if nothing else links to it.

### 2b. Completed / historical plans

**Leave them where they are.** Do not back-fill run folders for shipped work — run folders are audit trails created by the loop, not an archive to retrofit. If a historical plan is still the best explanation of a subsystem, link it from `ai/CONTEXT.md`'s architecture section.

### 2c. Roadmap / someday docs

Leave in place. If the project uses Linear, suggest converting roadmap bullets into backlog issues (that's where the framework expects future work to live), but don't do it unprompted — it changes the team's tracking system.

---

## Scenario 3 — Existing architecture / system docs

Leave in place, link from `ai/CONTEXT.md`:

```markdown
## Architecture overview

Event-sourced monolith; API and worker share one Postgres. Full details:
- [docs/architecture.md](../docs/architecture.md) — system diagram + service boundaries
- [docs/data-model.md](../docs/data-model.md) — schema and invariants
```

Write a 2–4 line summary above the links so an agent gets orientation without opening them. Never paste the doc bodies in.

---

## Scenario 4 — Existing conventions / style guides

Fold into `ai/STANDARDS.md`:

1. For each rule in the existing guide, merge it into the matching STANDARDS section (General / Error handling / Testing / Security / Performance / Documentation). Add stack-specific sections as needed.
2. On conflict between an existing rule and a framework default, **the existing rule wins** — it reflects the codebase as it actually is. Note overridden framework defaults in a one-line comment.
3. Replace the original guide with a pointer to `ai/STANDARDS.md`, or delete it if nothing links there. Two sources of truth for conventions is worse than either alone.

Also prune: if the repo has no AI-chat or CLI surface and none is planned, delete the Three-Surface Rule section from STANDARDS — it misdirects planning otherwise.

---

## Scenario 5 — Existing learnings / gotchas / "lessons learned" docs

These are usually one big file. Split into the knowledge base:

1. For each distinct learning, decide: **pitfall** (a failure mode to avoid) or **pattern** (an approach to reuse).
2. Create one file per item in `ai/knowledge/pitfalls/` or `patterns/` with a specific kebab-case slug and the required frontmatter:

   ```markdown
   ---
   title: "Convex preview key is distinct from dev key"
   tags: [convex, preview, key, deploy]
   related: []
   created: YYYY-MM-DD        # original date if known, else migration date
   last_referenced: null
   ---

   **Symptom:** ...
   **Root cause:** ...
   **How to recognize this:** ...
   **Fix:** ...
   ```

3. Skip items that fail the bar: obvious from a stack trace, fixed by reading the error message, or describing code that no longer exists. Migrating noise costs every future planning pass.
4. Run `node tools/migrate-knowledge-frontmatter.mjs` afterwards to validate/backfill frontmatter.
5. Tombstone or delete the original file.

---

## Scenario 6 — Existing ADRs / decision logs

- A dedicated `adr/` or `decisions/` folder with dated entries: **move** the files into `ai/knowledge/decisions/` preserving filenames and dates, or leave them and put a pointer README in `ai/knowledge/decisions/` saying where ADRs live. Either works; pick moving when the folder is small, pointing when other tooling (ADR CLIs, links) depends on the path.
- Decisions buried inside other docs: extract only ones that still constrain new work; one file each.

---

## Scenario 7 — Existing CI workflows

Never replace working CI. The framework's `ci.yml` is a template providing type-check + lint gates.

1. If the installer overwrote or added `.github/workflows/ci.yml` next to existing workflows, restore/check the existing ones (`git show HEAD:<path>`) and diff against the template.
2. Port missing gates (type-check, lint on PRs to main) into the **existing** workflow.
3. Delete the framework's `ci.yml` if its jobs are now covered. One workflow per concern beats two overlapping ones.

---

## Scenario 8 — Existing git hooks (husky, lefthook, custom `core.hooksPath`)

`tools/setup-hooks.sh` sets `core.hooksPath=.githooks`, which **disables** any existing hook manager. If the audit found `.husky/`, `lefthook.yml`, or a non-default `core.hooksPath`:

1. Do **not** run `setup-hooks.sh`.
2. Port the framework hooks' logic into the existing manager: the `pre-push` main-branch block + changed-file lint, and the `post-merge`/`post-rewrite` dep-drift reminders (read the installed `.githooks/*` files for the exact logic — they're short).
3. Optionally delete the now-unused `.githooks/` copies to avoid confusion about which hooks are live.

---

## Scenario 9 — Existing `tools/` directory

The installer merges (copies file-by-file). Collisions are only possible on the framework's filenames (`install.sh`, `linear-cli.mjs`, `spawn-agent.sh`, `dispatch-batch.sh`, `agent-status.sh`, `cleanup-merged.sh`, `bootstrap-worktree-backend.sh`, `setup-hooks.sh`, `post-pull.sh`, `eval-runner.mjs`, `gate-classifier.mjs`, `knowledge-usage.mjs`, `migrate-knowledge-frontmatter.mjs`). On a collision, recover the original from git, rename it (e.g. `tools/legacy-<name>`), and update anything that called it. The framework's names are load-bearing — skills and AGENTS.md reference them by path.

---

## Scenario 10 — Existing `.claude/skills/`

The installer merges. A name collision with `new-feature`, `ship-feature`, `independent-review`, `security-review`, or `efficiency-review` means the repo already had a skill of that name — recover it from git, compare, and either fold its project-specific steps into the framework skill (usually under the relevant step) or rename the old one. Project-specific skills with other names are unaffected.

---

## Scenario 11 — No Linear workspace

The framework assumes Linear as the work queue; the skills claim issues, post comments, and close issues through `tools/linear-cli.mjs`.

Without Linear:

- Install with placeholder `--team`/`--prefix` values (e.g. `--team None --prefix TASK`).
- The loop still works run-folder-first: create `ai/runs/<date>_TASK-<n>_<slug>/` manually and follow `ai/workflows/*.md`; skip the claim/comment/close steps in the skills (they fail gracefully without a key, but note the noise).
- Flag to the user that adopting Linear (or porting `linear-cli.mjs` to their tracker) unlocks the parallel-dispatch tooling — `dispatch-batch.sh` and the claim-lock depend on it.

---

## Scenario 12 — Monorepos

Install at the level where agents operate. One product per repo → repo root (normal case). Multiple independently-deployed apps with separate teams/issue prefixes → one install per app directory is possible (`--target apps/web`), but worktree-based parallelism still operates on the whole repo; prefer a single root install with per-app context linked from `CONTEXT.md` unless the apps are truly disjoint.

---

## Post-merge sanity pass

After working the scenarios above:

```bash
grep -rn '{ISSUE_PREFIX}\|{TEAM_NAME}' AGENTS.md ai/ .claude/ 2>/dev/null  # no hits
node tools/migrate-knowledge-frontmatter.mjs                                # if Scenario 5 ran
git diff --stat                                                             # review the full adoption diff
```

Confirm every pre-existing doc is either: untouched, tombstoned with a pointer, or deliberately deleted — never silently shadowed by a near-duplicate inside `ai/`.
