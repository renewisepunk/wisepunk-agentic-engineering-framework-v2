#!/usr/bin/env bash
# Spawn a new agent worktree wired up for parallel work.
#
# Usage:
#   tools/spawn-agent.sh --issue ACM-123 --slug my-feature
#   tools/spawn-agent.sh --issue ACM-123 --slug my-feature --dry-run
#
# What it does:
#   1. Creates a git worktree at .claude/worktrees/ACM-123-my-feature on branch agent/ACM-123-my-feature.
#   2. Copies .env.local into the worktree.
#   3. Activates the pre-push hook (.githooks/pre-push) for the worktree.
#   4. Delegates per-stack backend isolation (preview deployment, ports, env overrides)
#      to tools/bootstrap-worktree-backend.sh — which you customize for your stack.
#   5. Prints next-steps.
#
# Locking: the Linear-issue claim happens in the /new-feature skill, NOT here.
#          Run /new-feature next with the issue ID to claim and write the plan.
#
# Issue-prefix validation: by default this script accepts any [A-Z]+-[0-9]+ format.
# To restrict to your team's prefix only, edit the ISSUE_REGEX below.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Edit this to your team's specific prefix to enforce, e.g. ^ACM-[0-9]+$
ISSUE_REGEX='^[A-Z]+-[0-9]+$'

ISSUE=""
SLUG=""
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue) shift; ISSUE="$1"; shift ;;
    --slug)  shift; SLUG="$1";  shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$ISSUE" || -z "$SLUG" ]]; then
  echo "Usage: tools/spawn-agent.sh --issue <ISSUE> --slug short-name [--dry-run]" >&2
  exit 1
fi

if [[ ! "$ISSUE" =~ $ISSUE_REGEX ]]; then
  echo "ERROR: --issue must match $ISSUE_REGEX, got: $ISSUE" >&2
  exit 1
fi

# Sanitise slug
SLUG=$(echo "$SLUG" | tr '[:upper:]' '[:lower:]' | sed -E 's|[^a-z0-9-]+|-|g; s|^-+||; s|-+$||')
if [[ -z "$SLUG" ]]; then
  echo "ERROR: slug became empty after sanitisation" >&2
  exit 1
fi

BRANCH="agent/${ISSUE}-${SLUG}"
WORKTREE_DIR=".claude/worktrees/${ISSUE}-${SLUG}"

echo "Issue:     $ISSUE"
echo "Slug:      $SLUG"
echo "Branch:    $BRANCH"
echo "Worktree:  $WORKTREE_DIR"

if [[ ! -f .env.local ]]; then
  echo "ERROR: .env.local missing in main worktree" >&2
  exit 1
fi

# Allocate dev port: 3000 + (hash(branch) % 100)
PORT_OFFSET=$(printf "%s" "$BRANCH" | cksum | awk '{print $1 % 100}')
DEV_PORT=$((3000 + PORT_OFFSET))

echo "Dev port:  $DEV_PORT"

if [[ -d "$WORKTREE_DIR" ]]; then
  echo "ERROR: worktree directory already exists: $WORKTREE_DIR" >&2
  echo "       Run: tools/agent-status.sh --cleanup ${ISSUE}-${SLUG}" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "ERROR: branch already exists: $BRANCH" >&2
  exit 1
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "[dry-run] Would create:"
  echo "  git worktree add $WORKTREE_DIR -b $BRANCH"
  echo "  cp .env.local $WORKTREE_DIR/.env.local"
  echo "  tools/bootstrap-worktree-backend.sh --slug $SLUG --port $DEV_PORT"
  exit 0
fi

# 1. Create worktree
git worktree add "$WORKTREE_DIR" -b "$BRANCH"

# 1b. Activate pre-push hook (shared config across all worktrees)
(cd "$WORKTREE_DIR" && git config core.hooksPath .githooks)

# 2. Copy .env.local
cp .env.local "$WORKTREE_DIR/.env.local"

# 3. Delegate backend isolation to the per-stack bootstrap script.
if ! (cd "$WORKTREE_DIR" && bash "$REPO_ROOT/tools/bootstrap-worktree-backend.sh" --slug "$SLUG" --port "$DEV_PORT"); then
  echo "" >&2
  echo "Rolling back worktree..." >&2
  git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || true
  git branch -D "$BRANCH" 2>/dev/null || true
  exit 1
fi

cat <<EOF

✓ Worktree ready: $WORKTREE_DIR

Next steps (run inside the worktree):
  cd $WORKTREE_DIR
  <your install command>           # e.g. pnpm install / npm install / poetry install
  <your dev-server command>        # e.g. pnpm dev -p $DEV_PORT

Then in your agent session:
  /new-feature $ISSUE              # claims $ISSUE in Linear and writes the plan

When done: tools/agent-status.sh --cleanup ${ISSUE}-${SLUG}
EOF
