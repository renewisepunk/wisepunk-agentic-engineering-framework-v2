#!/usr/bin/env bash
# Show the status of all agent worktrees and (optionally) tear one down.
#
# Usage:
#   tools/agent-status.sh                                 # print status table
#   tools/agent-status.sh --cleanup ACM-123-feature       # remove worktree + branch

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CLEANUP_NAME=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --cleanup) shift; CLEANUP_NAME="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$CLEANUP_NAME" ]]; then
  WORKTREE_DIR=".claude/worktrees/${CLEANUP_NAME}"
  BRANCH="agent/${CLEANUP_NAME}"

  if [[ ! -d "$WORKTREE_DIR" ]]; then
    echo "ERROR: worktree not found: $WORKTREE_DIR" >&2
    exit 1
  fi

  # Read per-branch values from worktree .env.local before removing it
  SLUG=""
  if [[ -f "$WORKTREE_DIR/.env.local" ]]; then
    SLUG=$(grep '^AGENTIC_BRANCH_SLUG=' "$WORKTREE_DIR/.env.local" | head -1 | cut -d= -f2- || true)
  fi

  echo "Cleaning up $CLEANUP_NAME:"
  echo "  worktree:  $WORKTREE_DIR"
  echo "  branch:    $BRANCH"
  echo "  slug:      ${SLUG:-(unknown)}"
  echo ""
  read -r -p "Proceed? [y/N] " yn
  case "$yn" in
    [yY]*) ;;
    *) echo "aborted"; exit 1 ;;
  esac

  git worktree remove "$WORKTREE_DIR" --force
  echo "  ✓ worktree removed"

  git branch -D "$BRANCH" 2>/dev/null && echo "  ✓ branch deleted" || echo "  - branch already gone"

  if [[ -n "$SLUG" ]]; then
    echo ""
    echo "Note: your backend's preview deployment for '$SLUG' may need manual cleanup."
    echo "See docs/08-customizing.md for stack-specific cleanup notes."
  fi

  echo ""
  echo "Don't forget to unassign the Linear issue if the work isn't merged."
  exit 0
fi

# Status table
printf "%-30s %-40s %-12s %-8s %-12s %s\n" "WORKTREE" "BRANCH" "ISSUE" "PORT" "DEV-SERVER" "LAST COMMIT"
printf "%-30s %-40s %-12s %-8s %-12s %s\n" "$(printf '%.0s-' {1..30})" "$(printf '%.0s-' {1..40})" "------------" "--------" "------------" "-----------"

git worktree list --porcelain | awk '
  /^worktree / { path=$2 }
  /^branch / { branch=$2; print path "|" branch; path=""; branch="" }
' | while IFS='|' read -r WT_PATH BRANCH; do
  BRANCH=${BRANCH#refs/heads/}
  NAME=$(basename "$WT_PATH")

  # Extract issue ID from branch name agent/ACM-123-foo
  if [[ "$BRANCH" =~ agent/([A-Z]+-[0-9]+) ]]; then
    ISSUE="${BASH_REMATCH[1]}"
  else
    ISSUE="-"
  fi

  PORT="-"
  if [[ -f "$WT_PATH/.env.local" ]]; then
    PORT=$(grep '^AGENTIC_DEV_PORT=' "$WT_PATH/.env.local" 2>/dev/null | head -1 | cut -d= -f2- || echo "-")
    [[ -z "$PORT" ]] && PORT="-"
  fi

  DEV_STATUS="stopped"
  if [[ "$PORT" != "-" ]]; then
    if lsof -i :"$PORT" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
      DEV_STATUS="running"
    fi
  fi

  LAST_COMMIT=$(git -C "$WT_PATH" log -1 --pretty=format:'%h %s' 2>/dev/null | cut -c1-50 || echo "-")

  printf "%-30s %-40s %-12s %-8s %-12s %s\n" "$NAME" "$BRANCH" "$ISSUE" "$PORT" "$DEV_STATUS" "$LAST_COMMIT"
done

echo ""
echo "Cleanup: tools/agent-status.sh --cleanup <worktree-name>"
