#!/usr/bin/env bash
# Remove agent worktrees + branches whose PR is merged (or never opened).
#
# Usage:
#   tools/cleanup-merged.sh                 # remove every worktree whose branch has no open PR
#   tools/cleanup-merged.sh --dry-run       # show what would be removed
#   tools/cleanup-merged.sh --keep-stash    # leave the local branch in place (still remove worktree dir)
#   tools/cleanup-merged.sh --force-dirty   # remove even if the worktree has uncommitted tracked changes
#
# Why this exists: a big parallel burndown can leave dozens of orphan worktrees
# behind, duplicating gigabytes of working trees and filling the disk mid-batch.
# This script is the safety net. Run it after a merge sprint, or wire it into
# /ship-feature on a per-issue basis.
#
# Safety: only removes worktrees whose branch has NO open PR on GitHub. Worktrees
# with open PRs (or no PR yet) are left alone. The "main" worktree is never touched.
# Worktrees with uncommitted tracked changes are skipped unless --force-dirty is set.
# Build artifacts (e.g. .next/, dist/, node_modules/) are cleaned via rm -rf fallback
# if `git worktree remove --force` fails or leaves the directory behind (macOS quirk).

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DRY_RUN=false
KEEP_BRANCH=false
FORCE_DIRTY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --keep-stash) KEEP_BRANCH=true; shift ;;
    --force-dirty) FORCE_DIRTY=true; shift ;;
    -h|--help) sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# //; s/^#//'; exit 0 ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Build the list of branches with open PRs so we can skip them.
open_pr_branches=$(gh pr list --state open --limit 200 --json headRefName --jq '.[].headRefName' 2>/dev/null | sort -u)

# Enumerate worktrees (skip the main one — it's not under .claude/worktrees/).
mapfile -t WORKTREES < <(git worktree list --porcelain 2>/dev/null | awk '
  /^worktree /{ path=$2 }
  /^branch /{ if (path ~ /\.claude\/worktrees\//) print path "\t" $2 }
')

if [[ ${#WORKTREES[@]} -eq 0 ]]; then
  echo "No agent worktrees to clean."
  exit 0
fi

removed=0
skipped=0
skipped_dirty=0
failed=0

# Remove a directory, using git worktree remove first then rm -rf as fallback.
# Build artifacts (e.g. .next/dev/server, dist/) can survive git worktree remove --force on macOS.
remove_worktree_dir() {
  local wt_path="$1"

  # Guard against empty or root paths — should never happen given the awk filter, but be safe.
  if [[ -z "$wt_path" || "$wt_path" == "/" ]]; then
    echo "  ERROR: remove_worktree_dir called with unsafe path: '$wt_path'" >&2
    return 1
  fi

  if git worktree remove --force "$wt_path" 2>/dev/null; then
    # Directory may still exist on macOS due to build artifacts (e.g. .next/dev/server).
    if [[ -d "$wt_path" ]]; then
      echo "  [rm -rf] git worktree remove succeeded but dir remains (build artifacts) — rm -rf $wt_path"
      rm -rf "$wt_path"
    fi
    return 0
  fi

  # git worktree remove --force failed (e.g. build-artifact locks on macOS).
  echo "  [rm -rf] git worktree remove --force failed — falling back to rm -rf $wt_path"
  if rm -rf "$wt_path"; then
    # Deregister the now-deleted path from git's worktree list.
    git worktree prune 2>/dev/null || true
    return 0
  else
    echo "  ERROR: rm -rf $wt_path also failed (permissions?)" >&2
    return 1
  fi
}

for entry in "${WORKTREES[@]}"; do
  path="${entry%%	*}"
  branch_ref="${entry##*	}"
  branch="${branch_ref#refs/heads/}"

  # Skip if branch has an open PR.
  if echo "$open_pr_branches" | grep -qx "$branch"; then
    echo "  SKIP (open PR): $path"
    skipped=$((skipped + 1))
    continue
  fi

  # Check for uncommitted tracked changes (ignore untracked files — build artifacts are fine to rm).
  dirty_files=$(git -C "$path" status --porcelain 2>/dev/null | grep -v '^??' || true)
  if [[ -n "$dirty_files" && "$FORCE_DIRTY" == "false" ]]; then
    dirty_count=$(echo "$dirty_files" | wc -l | tr -d ' ')
    echo "  SKIP (dirty: $dirty_count modified file(s) — use --force-dirty to override): $path"
    echo "$dirty_files" | sed 's/^/    /'
    skipped_dirty=$((skipped_dirty + 1))
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    if [[ -n "$dirty_files" ]]; then
      dirty_count=$(echo "$dirty_files" | wc -l | tr -d ' ')
      echo "  [dry-run] would remove $path (branch $branch) [WARNING: $dirty_count dirty file(s)]"
    else
      echo "  [dry-run] would remove $path (branch $branch)"
    fi
    removed=$((removed + 1))
    continue
  fi

  if remove_worktree_dir "$path"; then
    if [[ "$KEEP_BRANCH" != "true" && -n "$branch" && "$branch" != "HEAD" ]]; then
      git branch -D "$branch" 2>/dev/null || true
    fi
    removed=$((removed + 1))
  else
    failed=$((failed + 1))
  fi
done

git worktree prune 2>/dev/null || true

echo ""
echo "Cleanup summary:"
echo "  Removed:             $removed"
echo "  Skipped (open PR):   $skipped"
echo "  Skipped (dirty):     $skipped_dirty"
if [[ $failed -gt 0 ]]; then
  echo "  Failed:              $failed  ← manual cleanup required"
fi
if [[ "$DRY_RUN" == "true" ]]; then
  echo "  (dry-run — nothing was actually removed)"
fi
