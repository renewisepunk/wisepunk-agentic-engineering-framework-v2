#!/usr/bin/env bash
# Bootstrap an agent worktree's isolated backend.
#
# This is a STACK-AGNOSTIC STUB. You need to customize it for your backend.
#
# What it does out of the box:
#   1. Validates we're in a worktree (not the main repo)
#   2. Allocates a deterministic dev port from the branch name
#   3. Writes AGENTIC_BRANCH_SLUG + AGENTIC_DEV_PORT into the worktree's .env.local
#
# What YOU should add (per stack):
#   4. Create a preview deployment of your backend (Convex, Supabase, Neon, etc.)
#   5. Write the preview deployment URL/key into the worktree's .env.local
#   6. (Optional) Create any per-branch external services (queue, edge fn, etc.)
#
# See docs/08-customizing.md in the framework repo for stack-specific recipes.
#
# Usage:
#   tools/bootstrap-worktree-backend.sh --slug add-schedules [--port 3064]
#
# Idempotent: safe to call multiple times — exits early if .env.local shows isolation in place.

set -euo pipefail

SLUG=""
PORT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) shift; SLUG="$1"; shift ;;
    --port) shift; PORT="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SLUG" ]]; then
  echo "Usage: tools/bootstrap-worktree-backend.sh --slug <slug> [--port <port>]" >&2
  exit 1
fi

# Sanitise
SLUG=$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's|[^a-z0-9-]+|-|g; s|^-+||; s|-+$||')

# Verify we're in a worktree, not the main repo
PWD_PATH=$(pwd)
if [[ "$PWD_PATH" != *"/.claude/worktrees/"* ]]; then
  echo "ERROR: not in a worktree (cwd: $PWD_PATH)" >&2
  echo "       Run this from inside .claude/worktrees/<name>/" >&2
  exit 1
fi

if [[ ! -f .env.local ]]; then
  echo "ERROR: no .env.local in $(pwd) — copy one from the main worktree first" >&2
  exit 1
fi

# Idempotency check — already bootstrapped?
if grep -q '^AGENTIC_BRANCH_SLUG=' .env.local; then
  EXISTING=$(grep '^AGENTIC_BRANCH_SLUG=' .env.local | head -1 | cut -d= -f2-)
  echo "✓ Backend already isolated (AGENTIC_BRANCH_SLUG=$EXISTING)"
  exit 0
fi

# Allocate port if not given
if [[ -z "$PORT" ]]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  PORT_OFFSET=$(printf "%s" "$BRANCH" | cksum | awk '{print $1 % 100}')
  PORT=$((3000 + PORT_OFFSET))
fi

echo "Slug:        $SLUG"
echo "Port:        $PORT"
echo ""

# Append per-branch values
cat >> .env.local <<EOF

# Per-branch values written by tools/bootstrap-worktree-backend.sh
AGENTIC_BRANCH_SLUG=$SLUG
AGENTIC_DEV_PORT=$PORT
EOF

# ----------------------------------------------------------------------------
# STACK-SPECIFIC BACKEND ISOLATION — REPLACE THIS BLOCK
# ----------------------------------------------------------------------------
#
# Example (Convex):
#   PREVIEW_KEY=$(grep '^CONVEX_PREVIEW_DEPLOY_KEY=' .env.local | head -1 | cut -d= -f2-)
#   if [[ "$PREVIEW_KEY" == dev:* ]]; then
#     echo "ERROR: that's a dev key, not a preview key" >&2; exit 1
#   fi
#   PREVIEW_OUTPUT=$(CONVEX_DEPLOY_KEY="$PREVIEW_KEY" \
#     npx convex deploy --preview-create "$SLUG" \
#       --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
#       --cmd 'printenv NEXT_PUBLIC_CONVEX_URL' 2>&1)
#   PREVIEW_URL=$(printf "%s" "$PREVIEW_OUTPUT" | grep -oE 'https://[a-z0-9-]+\.convex\.cloud' | tail -1)
#   sed -i.bak "s|^NEXT_PUBLIC_CONVEX_URL=.*|NEXT_PUBLIC_CONVEX_URL=$PREVIEW_URL|" .env.local
#   sed -i.bak "s|^CONVEX_DEPLOYMENT=.*|CONVEX_DEPLOYMENT=preview:$SLUG|" .env.local
#
# Example (Supabase branches):
#   ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | head -1 | cut -d= -f2-)
#   PROJECT_REF=$(grep '^SUPABASE_PROJECT_REF=' .env.local | head -1 | cut -d= -f2-)
#   BRANCH_RESP=$(curl -s -X POST \
#     "https://api.supabase.com/v1/projects/$PROJECT_REF/branches" \
#     -H "Authorization: Bearer $ACCESS_TOKEN" \
#     -H "Content-Type: application/json" \
#     -d "{\"branch_name\":\"$SLUG\"}")
#   BRANCH_URL="https://$(echo "$BRANCH_RESP" | jq -r '.id').supabase.co"
#   sed -i.bak "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$BRANCH_URL|" .env.local
#
# Example (Neon Postgres branches):
#   NEON_KEY=$(grep '^NEON_API_KEY=' .env.local | head -1 | cut -d= -f2-)
#   PROJECT_ID=$(grep '^NEON_PROJECT_ID=' .env.local | head -1 | cut -d= -f2-)
#   RESP=$(curl -s -X POST \
#     "https://console.neon.tech/api/v2/projects/$PROJECT_ID/branches" \
#     -H "Authorization: Bearer $NEON_KEY" -H "Content-Type: application/json" \
#     -d "{\"branch\":{\"name\":\"$SLUG\"}}")
#   DATABASE_URL=$(echo "$RESP" | jq -r '.connection_uris[0].connection_uri')
#   sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=$DATABASE_URL|" .env.local
#
# ----------------------------------------------------------------------------

rm -f .env.local.bak

echo "✓ Worktree env bootstrapped:"
echo "  AGENTIC_BRANCH_SLUG=$SLUG"
echo "  AGENTIC_DEV_PORT=$PORT"
echo ""
echo "⚠ Backend isolation is NOT configured (this is the framework stub)."
echo "  Customize this script for your stack — see docs/08-customizing.md."
