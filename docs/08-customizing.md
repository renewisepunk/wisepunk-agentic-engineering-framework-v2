# 08 — Customizing for Your Stack

The framework is opinionated about workflow but neutral about stack. This doc covers the per-stack adaptations you'll need.

---

## The two extension points

The framework's tools are mostly stack-agnostic. Two files need stack-specific adaptation:

1. **`tools/bootstrap-worktree-backend.sh`** — creates a preview backend per worktree. The default stub allocates a port and sets env vars; you add the preview-creation step for your stack.

2. **`.claude/skills/ship-feature/SKILL.md` Step 3** — deploys the backend. The default skill has a placeholder; replace with your stack's deploy command.

Everything else (Linear CLI, dispatch-batch, agent-status, pre-push hook, workflows, plan template) is portable as-is.

---

## Stack recipes

### Convex (the reference implementation)

**Preview backend:** Convex preview deployments — one isolated DB + functions per branch.

**Setup:**

1. Generate a preview deploy key in the Convex dashboard (Settings → Preview Deploy Keys, **not** Deploy Keys).
2. Save as `CONVEX_PREVIEW_DEPLOY_KEY=preview:xxxxx` in `.env.local`.
3. Add to `bootstrap-worktree-backend.sh`:

```bash
PREVIEW_KEY=$(grep '^CONVEX_PREVIEW_DEPLOY_KEY=' .env.local | head -1 | cut -d= -f2-)

if [[ "$PREVIEW_KEY" == dev:* ]]; then
  echo "ERROR: that's a dev key, not a preview key" >&2
  exit 1
fi

PREVIEW_OUTPUT=$(CONVEX_DEPLOY_KEY="$PREVIEW_KEY" \
  npx convex deploy --preview-create "$SLUG" \
    --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
    --cmd 'printenv NEXT_PUBLIC_CONVEX_URL' 2>&1)

PREVIEW_URL=$(printf "%s" "$PREVIEW_OUTPUT" | grep -oE 'https://[a-z0-9-]+\.convex\.cloud' | tail -1)

sed -i.bak "s|^NEXT_PUBLIC_CONVEX_URL=.*|NEXT_PUBLIC_CONVEX_URL=$PREVIEW_URL|" .env.local
sed -i.bak "s|^CONVEX_DEPLOYMENT=.*|CONVEX_DEPLOYMENT=preview:$SLUG|" .env.local
```

**Deploy in `/ship-feature`:**

```bash
CONVEX_DEPLOY_KEY=$(grep '^CONVEX_PREVIEW_DEPLOY_KEY=' .env.local | head -1 | cut -d= -f2-) \
  npx convex deploy --preview-name "$(grep '^AGENTIC_BRANCH_SLUG=' .env.local | head -1 | cut -d= -f2-)" --yes
```

**Caveat:** Convex CLI has no preview-delete subcommand. Previews auto-expire after 5 days (free) / 14 days (Pro+). Delete sooner via the dashboard if you hit slot limits.

**Full working example:** [examples/paul9.md](../examples/paul9.md).

---

### Supabase

**Preview backend:** Supabase branches (currently Pro plan only).

**Setup:**

1. Enable branching on your project (dashboard → Branches).
2. Get a service role key.
3. Add to `bootstrap-worktree-backend.sh`:

```bash
SUPABASE_PROJECT_REF="<your-ref>"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | head -1 | cut -d= -f2-)

# Create branch via Management API
BRANCH_RESPONSE=$(curl -s -X POST \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/branches" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"branch_name\": \"$SLUG\", \"git_branch\": \"$(git branch --show-current)\"}")

BRANCH_REF=$(echo "$BRANCH_RESPONSE" | jq -r '.id')
BRANCH_URL="https://$BRANCH_REF.supabase.co"

sed -i.bak "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$BRANCH_URL|" .env.local
```

**Deploy in `/ship-feature`:** Supabase branches don't need an explicit deploy step — schema migrations are run via the CLI:

```bash
supabase db push --db-url "$DATABASE_URL"
```

---

### Vercel + Postgres (e.g. Neon, PlanetScale)

**Preview backend:** Vercel branch previews + a per-branch Neon/PlanetScale branch.

**Neon recipe:**

```bash
NEON_API_KEY=$(grep '^NEON_API_KEY=' .env.local | head -1 | cut -d= -f2-)
NEON_PROJECT_ID=$(grep '^NEON_PROJECT_ID=' .env.local | head -1 | cut -d= -f2-)

BRANCH_RESPONSE=$(curl -s -X POST \
  "https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"branch\": {\"name\": \"$SLUG\"}}")

DATABASE_URL=$(echo "$BRANCH_RESPONSE" | jq -r '.connection_uris[0].connection_uri')

sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env.local
```

**Vercel preview URL:** Vercel auto-creates per-branch previews on push. The URL is predictable: `https://<project>-git-<branch>-<scope>.vercel.app`. Pass it to your smoke suite via `PAUL9_APP_URL`.

---

### No preview backend (single shared dev)

For early-stage projects without preview backends, agents share one dev environment. To minimize collisions:

- Keep the parallel-agent count to 1–2.
- Use feature flags or namespacing in your schema (e.g. all test data prefixed with the slug).
- Skip the bootstrap-worktree-backend.sh step (or leave it as just port allocation).

This is the "minimal example" in [examples/minimal.md](../examples/minimal.md).

---

## Adapting AGENTS.md and CLAUDE.md

The shipped `AGENTS.md` template uses placeholders:

```markdown
# Agentic Engineering Framework

This project uses {WORKFLOW_NAME} for AI-assisted development with multiple Claude
Code agents in parallel on {ISSUE_TRACKER} issues.

## Before starting any task

1. Read `ai/CONTEXT.md` to understand the project.
2. Read `ai/STANDARDS.md` for engineering conventions.
3. Check `ai/knowledge/pitfalls/` for known failure modes.

## Skills

- **`/new-feature {ISSUE_PREFIX}-XXX`** — Start a feature.
- **`/ship-feature`** — Run after implementation is complete.
```

The installer substitutes `{ISSUE_PREFIX}`. Edit the rest by hand for your stack.

Add stack-specific reminders at the bottom:

```markdown
## Stack-specific reminders

- **After any change to `<stack-specific>` files, redeploy:** `<command>`. Auto-detects worktree vs main.
- **Schema migrations:** run `<command>` after editing `<schema-file>`.
- **Always update `<file>` when adding a new <thing>.**
```

These prevent the "I forgot to redeploy" class of bugs.

---

## Adapting STANDARDS.md

The shipped STANDARDS.md is the base. Add to it as your team's conventions emerge.

Don't *delete* the Three-Surface Rule unless you've thought about it carefully. The framework's effectiveness leans heavily on every capability living in three predictable places.

**Examples of stack-specific standards worth adding:**

- "Every Postgres migration must be reversible — provide `down()` alongside `up()`."
- "Every API route validates its request body with zod before doing anything else."
- "Every React Query hook has a corresponding `useSuspense*` variant for the Suspense boundary."

---

## Adapting CI

The shipped `ci.template.yml` assumes:

- Node 20 + pnpm
- TypeScript via `tsc --noEmit`
- ESLint

Adapt for other stacks:

- **Python:** swap to `setup-python@v5`, replace `tsc` with `mypy`, lint with `ruff` or `pyright`.
- **Go:** `setup-go@v5`, `go build ./...`, `golangci-lint run`.
- **Rust:** `dtolnay/rust-toolchain@stable`, `cargo check`, `cargo clippy`.

Keep the principles:

- **Concurrency cancel-in-progress** for fast feedback on rapid pushes.
- **Path filters** if you have monorepo subdirectories that don't need full builds.
- **Lint changed files only** on PRs (full-repo on main only).

---

## Adapting skills

The shipped skills reference specific files and commands. Edit per stack:

### `/new-feature` Step 7 (Write plan.md)

The plan template's "Test plan" section lists:

```markdown
### TypeScript
### Convex functions
### API routes
### UI smoke test
### CLI/API test
```

Rename "Convex functions" to whatever your backend functions are called.

### `/ship-feature` Step 2 (Deploy backend)

The skill has placeholders for the deploy command. Fill in per stack:

```markdown
**Agent worktree (preview deployment)** — when `.env.local` has `AGENTIC_BRANCH_SLUG` set:
\`\`\`bash
# YOUR STACK'S DEPLOY COMMAND HERE
# Convex: CONVEX_DEPLOY_KEY=... npx convex deploy --preview-name "$slug" --yes
# Supabase: supabase db push --db-url "$DATABASE_URL"
# Vercel: handled automatically by git push to branch
\`\`\`
```

### `/ship-feature` Step 2.5 (Rebase + resolve)

Common conflict files vary per stack. Edit the documented patterns to match your repo:

- Codegen files (e.g. `*_generated/api.d.ts`, `prisma/client/`, `**/generated.ts`)
- Mega-files (chat tool registry, route registry, schema)
- Pre-existing lint debt files

---

## Mega-file split

If your codebase has files that every agent touches (chat tool registry, HTTP route registry, schema), splitting them into per-feature files removes a whole class of merge conflict.

### Pattern: auto-aggregating index

```typescript
// Before: app/api/chat/route.ts — every agent edits this
export const tools = {
  createSchedule,
  listSchedules,
  // ... 30 more
};

// After: app/api/chat/tools/<name>.ts — one file each
// app/api/chat/tools/createSchedule.ts
export const createSchedule = tool({ ... });

// app/api/chat/tools/index.ts — auto-aggregates via import-glob (Vite/esbuild plugin) or build step
import { glob } from 'glob';
const modules = await Promise.all(
  glob.sync('./tools/*.ts').map((p) => import(p))
);
export const tools = Object.fromEntries(
  modules.flatMap((m) => Object.entries(m))
);
```

Result: adding a tool means creating a file. Never editing the index. No conflicts.

Apply the same pattern to:

- HTTP routes (`convex/http/<name>.ts` + auto-registered index)
- Schema (`convex/schema/<feature>.ts` + composed at top)
- Frontend route registry (Next.js App Router already does this via filesystem)

---

## Migration path for an existing project

If you're adopting the framework on a project that's already running:

1. **Day 1 — Install + customize.** Run the installer; fill in CONTEXT, STANDARDS, AGENTS.md. Get the skills working with one issue end-to-end.

2. **Week 1 — Single-agent flow.** Use `/new-feature` and `/ship-feature` for every issue, sequentially. Build confidence in the loop.

3. **Week 2 — Two parallel agents.** Try `tools/spawn-agent.sh` for one issue while you work on another. See if isolation holds.

4. **Week 3 — Backend isolation.** Wire up `bootstrap-worktree-backend.sh` for your stack. Verify two agents with different schema changes can coexist.

5. **Month 1 — Compounding.** Run compound after every feature. Read the pitfalls before starting work. Watch the knowledge base grow.

6. **Month 2+ — Batch dispatch.** Once you trust the loop, use `tools/dispatch-batch.sh` to drain tiers of unblocked issues in parallel.

Don't try to do all of this on day 1. The system pays off cumulatively.

---

## Next

- **Worked example with full Convex stack:** [examples/paul9.md](../examples/paul9.md)
- **Minimal setup without preview backends:** [examples/minimal.md](../examples/minimal.md)
- **Troubleshooting:** [09-troubleshooting.md](./09-troubleshooting.md)
