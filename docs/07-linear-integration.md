# 07 — Linear Integration

The framework uses Linear as the work queue and the lock. This doc covers how the integration works, what to set up, and how to operate it day to day.

---

## Why Linear (and not GitHub Issues / Jira / Notion)

Linear has three properties this framework depends on:

1. **Stable issue IDs** (`ACM-42`) that branch names, run-folder names, and commit messages can all reference.
2. **A `blockedBy` relation** that's queryable via API — used by `dispatch-batch.sh` to refuse dispatching dependent issues whose blockers haven't merged.
3. **A fast, well-documented GraphQL API** with personal API keys that work in headless / background sessions.

The framework's `tools/linear-cli.mjs` wraps the API. Replacing Linear with another system means rewriting that file. Doable but not trivial — PRs welcome.

---

## Setup

### 1. Get a personal API key

linear.app → Settings → Account → Security → Personal API keys → New API key.

Add to `.env.local`:

```bash
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxx
```

Confirm `.env.local` is in `.gitignore`.

### 2. Note your team's issue prefix

In Linear, teams have a key (visible at Settings → Workspace → Teams):

- Team **"Acme"** → key **"ACM"** → issues are `ACM-1`, `ACM-2`…

The framework templates refer to issues as `{ISSUE_PREFIX}-N`. The installer (`tools/install.sh`) substitutes this for your real prefix; if you skipped that, edit `ai/templates/plan.md` and `.agents/skills/*/SKILL.md` to replace `{ISSUE_PREFIX}`.

### 3. Verify the CLI works

```bash
node tools/linear-cli.mjs list --team Acme --state Backlog --limit 5
```

You should see JSON for up to 5 backlog issues. If you get `LINEAR_API_KEY not set`, your `.env.local` isn't being read — make sure you're in the repo root.

---

## The CLI

`tools/linear-cli.mjs` is a small REST/GraphQL wrapper. Used everywhere skills touch Linear.

### Commands

```bash
# Fetch an issue (returns JSON: id, title, description, state, assignee, url)
node tools/linear-cli.mjs get ACM-42

# Claim an issue (race-safe; exits 2 if owned by another agent)
node tools/linear-cli.mjs claim ACM-42 --email rene@acme.com

# Post a comment
node tools/linear-cli.mjs comment ACM-42 --body "Plan posted at ai/runs/..."

# Close an issue (moves to "Completed" state)
node tools/linear-cli.mjs close ACM-42

# List backlog
node tools/linear-cli.mjs list --team Acme --state Backlog --unassigned --limit 20

# Get dependencies (returns blockedBy + description for batch pre-flight)
node tools/linear-cli.mjs deps ACM-42
```

All commands print JSON to stdout. Errors go to stderr with exit code 1; claim races exit with code 2.

### Why not the Linear MCP

The Linear MCP server (when available via claude.ai or local install) works for interactive sessions but **does not pass through to background sessions** reliably. Since most of the framework runs in background sessions dispatched by Agent View, the MCP can't be the dependency.

The CLI works everywhere a Node process can run, with just `LINEAR_API_KEY` in env. That's the framework's baseline.

---

## How skills use Linear

### `/new-feature`

1. `linear-cli get <ISSUE>` → read title, description, URL
2. `linear-cli claim <ISSUE> --email <git config user.email>` → lock + move to In Progress
3. `linear-cli comment <ISSUE> --body "Plan posted at..."` → log progress

### `/ship-feature`

1. `linear-cli comment <ISSUE> --body "Shipped — <summary>"` → final report
2. `linear-cli close <ISSUE>` → move to Completed

### `dispatch-batch.sh`

For each issue in the batch:

1. `linear-cli deps <ISSUE>` → fetch `blockedBy` + description
2. Cross-check against other issues in the batch — refuse to dispatch dependents whose blockers haven't merged.

---

## Operating model

### Projects = phases of work

Use Linear projects to group related issues. The Paul9 reference has projects like:

- **AI-First Action System** — the Three-Surface enforcement work
- **Scheduling System** — schedule cron + UI + chat
- **Lead Gen & Email Outreach** — the wowere-inspired pipeline

Each project has a clear scope and target date. Issues within get dispatched as a tier.

### Issues = atomic work orders

One issue = one PR. Resist the temptation to bundle. Small PRs are easier to review, faster to merge, less conflict-prone for parallel agents.

If you find yourself writing an issue that's "build the schema and the helpers and the routes and the UI," split it into 4 issues with `blockedBy` relations. Dispatch the schema, merge it, then dispatch the others.

### `blockedBy` is the dependency lock

Use it. If `ACM-43` needs `ACM-42`'s schema to exist, set `ACM-43.blockedBy = [ACM-42]`. `dispatch-batch.sh` will refuse to dispatch them together.

### Status transitions

The skills handle these for you:

- `Backlog → In Progress` — set by `/new-feature` when claiming
- `In Progress → Done` (or Completed) — set by `/ship-feature` when closing

You can use custom states (In Review, Blocked, etc.) but the skills don't write to them. Manual transitions are fine.

---

## Conventions worth adopting

### Issue title format

The plan template generates a kebab-case slug from the issue title. Good titles:

- ✓ "Add schedules schema with cron + nextRunAt + lastRunAt"
- ✓ "Wire chat tool createSchedule → lib/actions/schedules"
- ✗ "Schedules stuff"
- ✗ "Make it work"

The title is the work order. Make it specific.

### Issue description format

For the agent's benefit, structure descriptions:

```markdown
## Why
<one paragraph — what user problem does this solve?>

## What
<concrete deliverable — what does "done" look like?>

## Acceptance criteria
- Given X, when Y, then Z

## Scope discipline
In scope: ...
Out of scope: ...

## References
- Related issue: ACM-X
- Affected files: lib/foo.ts, convex/bar.ts
```

This format maps directly to the plan template. The agent fills in the rest.

### Project descriptions

Use them to explain *why* a project exists, not what's in it (Linear shows the issue list anyway). The framework's `/new-feature` skill doesn't read project descriptions today, but humans skim them when prioritizing.

---

## Common failure modes

- **"LINEAR_API_KEY not set"** — you're not in the repo root, or `.env.local` doesn't have the key. Run `pwd` and `grep LINEAR_API_KEY .env.local` to diagnose.
- **"ABORT: ACM-42 is already assigned to <other>"** — the lock is working. Pick another issue.
- **"User with email rene@acme.com not found in Linear workspace"** — your `git config user.email` doesn't match a Linear user. Either fix the git config (`git config user.email`) or pass `--email <correct>` explicitly.
- **`claim` exits 2 but issue isn't actually assigned** — race lost between read and re-read. Wait a moment and try again, or just pick another issue.
- **`comment` works but doesn't show up in Linear UI** — Linear caches aggressively. Refresh the page; the comment is there.

---

## What's missing (PRs welcome)

- **Issue creation from the CLI** — `linear-cli create --title "..." --team Acme --project "..."` would let `/ship-feature` auto-create follow-up issues for Should-fix findings. The MCP-based path exists in interactive sessions but not in CLI form.
- **Label management** — for tagging issues with "scope:schema" / "scope:helper" / etc. so the duplicate-work check in `/new-feature` is more targeted.
- **Webhook handler** — so a merged PR could automatically transition the issue, rather than relying on `/ship-feature`'s close call.

---

## Next

- **Customizing for your backend:** [08-customizing.md](./08-customizing.md)
- **Troubleshooting:** [09-troubleshooting.md](./09-troubleshooting.md)
