#!/usr/bin/env bash
# Dispatch a batch of Linear issues as parallel Claude Code background agents.
#
# Each issue becomes its own Agent View session, with its own git worktree (auto-created
# by Claude), per-branch backend, and dev port (set up by /new-feature's bootstrap step).
#
# Usage:
#   tools/dispatch-batch.sh ACM-90 ACM-83 ACM-74 ACM-99
#   tools/dispatch-batch.sh --force ACM-127 ACM-130   # bypass dependency check
#
# Monitor with:
#   claude agents
#
# Requirements:
#   - Claude Code v2.1.139+
#   - .env.local has LINEAR_API_KEY + whatever your bootstrap script needs
#   - You've previously accepted "auto" permission mode at least once interactively
#     (Claude refuses auto from --bg until it's been accepted once)
#
# Why auto mode: a backgrounded agent stuck on every Bash permission prompt is
# useless. Auto lets it make reasonable judgment calls; risky operations still
# pause for your attention via Agent View's "Needs input" group.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Edit this to your team's specific prefix to enforce, e.g. ^ACM-[0-9]+$
ISSUE_REGEX='^[A-Z]+-[0-9]+$'

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
FORCE=false
ISSUES=()

for arg in "$@"; do
  if [[ "$arg" == "--force" ]]; then
    FORCE=true
  elif [[ "$arg" =~ $ISSUE_REGEX ]]; then
    ISSUES+=("$arg")
  else
    echo "ERROR: unrecognised argument: '$arg' (expected $ISSUE_REGEX or --force)" >&2
    exit 1
  fi
done

if [[ ${#ISSUES[@]} -eq 0 ]]; then
  cat <<EOF >&2
Usage: tools/dispatch-batch.sh [--force] <ISSUE-X> <ISSUE-Y> <ISSUE-Z>...

Each positional argument must be a Linear issue ID matching $ISSUE_REGEX.
--force  Skip dependency pre-flight and dispatch anyway (with warning).

After dispatch, open Agent View to monitor:
  claude agents
EOF
  exit 1
fi

# ---------------------------------------------------------------------------
# Pre-flight: detect intra-batch dependencies before firing any agent.
#
# Two checks:
#   1. blockedBy relations in Linear (authoritative — hard block)
#   2. cross-references in issue descriptions (heuristic — warning only)
#
# On API failure: fail-open (warn and continue).
# ---------------------------------------------------------------------------
preflight_check() {
  local -a batch=("$@")
  local batch_size=${#batch[@]}

  if [[ $batch_size -lt 2 ]]; then
    return 0
  fi

  echo "Pre-flight: checking intra-batch dependencies for ${batch_size} issues..." >&2

  local hard_blocks=0
  local soft_warns=0

  for issue in "${batch[@]}"; do
    local deps_json
    if ! deps_json=$(node tools/linear-cli.mjs deps "$issue" 2>/dev/null); then
      echo "  ⚠ Could not fetch deps for $issue (API error) — skipping check" >&2
      continue
    fi

    local blocked_by description
    blocked_by=$(node -e "
      try {
        const d = JSON.parse(process.argv[1]);
        console.log((d.blockedBy || []).join('\n'));
      } catch { process.exit(0); }
    " "$deps_json" 2>/dev/null || true)

    description=$(node -e "
      try {
        const d = JSON.parse(process.argv[1]);
        process.stdout.write(d.description || '');
      } catch { process.exit(0); }
    " "$deps_json" 2>/dev/null || true)

    if [[ -n "$blocked_by" ]]; then
      while IFS= read -r blocker; do
        [[ -z "$blocker" ]] && continue
        for batchIssue in "${batch[@]}"; do
          if [[ "$blocker" == "$batchIssue" ]]; then
            echo "  ✗ HARD DEPENDENCY: $issue is blocked by $blocker (Linear blockedBy relation)" >&2
            hard_blocks=$((hard_blocks + 1))
          fi
        done
      done <<< "$blocked_by"
    fi

    if [[ -n "$description" ]]; then
      for batchIssue in "${batch[@]}"; do
        [[ "$batchIssue" == "$issue" ]] && continue
        if echo "$description" | grep -q "$batchIssue"; then
          echo "  ⚠ POSSIBLE DEPENDENCY: $issue description references $batchIssue" >&2
          soft_warns=$((soft_warns + 1))
        fi
      done
    fi
  done

  if [[ $hard_blocks -gt 0 ]]; then
    echo "" >&2
    echo "✗ Found $hard_blocks hard dependency(ies) within the batch." >&2
    echo "  Dispatch sequentially — ship the foundation issue(s) first." >&2
    echo "  Or use --force to bypass this check." >&2
    if [[ "$FORCE" == "true" ]]; then
      echo "  --force set: proceeding despite hard dependencies." >&2
      echo "" >&2
    else
      exit 1
    fi
  elif [[ $soft_warns -gt 0 ]]; then
    echo "" >&2
    echo "⚠ Found $soft_warns description cross-reference(s) — possible dependency." >&2
    echo "  Verify these issues are truly independent before continuing." >&2
    echo "  Continuing in 5 seconds (Ctrl+C to abort)..." >&2
    if [[ "$FORCE" != "true" ]]; then
      sleep 5
    fi
    echo "" >&2
  else
    echo "  ✓ No intra-batch dependencies detected." >&2
    echo "" >&2
  fi
}

preflight_check "${ISSUES[@]}"

echo "Dispatching ${#ISSUES[@]} parallel agent sessions:"
for issue in "${ISSUES[@]}"; do
  echo "  → $issue"
done
echo ""

if [[ ${#ISSUES[@]} -gt 5 ]]; then
  echo "⚠ Dispatching ${#ISSUES[@]} agents simultaneously will burn through Claude quota and" >&2
  echo "  backend preview slots fast. Press Ctrl+C in the next 5 seconds to abort." >&2
  sleep 5
fi

PIPELINE_PROMPT='Take %ISSUE% from backlog to merged PR using the full pipeline:

1. Run the /new-feature skill for %ISSUE% — claim the issue in Linear (use `node tools/linear-cli.mjs claim %ISSUE% --email $(git config user.email)`), bootstrap backend isolation, and write plan.md.

2. Implement the plan following ai/workflows/work.md. Keep changes scoped to what %ISSUE% asks for — do NOT absorb follow-on issues even if Three-Surface tempts you (see /new-feature scope discipline section).

3. Run /ship-feature — static checks, deploy preview, verify tests per the plan, write review.md, run compound.md, post results to Linear (use `node tools/linear-cli.mjs comment` and `close`), open the PR with `gh pr create`.

Keep going through all three phases without stopping for confirmation. If you hit a real blocker, surface it via recap.'

for issue in "${ISSUES[@]}"; do
  echo "→ Dispatching $issue..."
  PROMPT="${PIPELINE_PROMPT//%ISSUE%/$issue}"
  claude --bg --permission-mode auto --name "$issue" "$PROMPT"
done

cat <<EOF

✓ All sessions dispatched. Open Agent View to monitor:
  claude agents

Tips:
  - Sessions group by state. Watch "Needs input" — that's where attention is required.
  - Press Space on a row to peek; press Enter to attach.
  - Each agent's plan, worklog, and review live under .claude/worktrees/<name>/ai/runs/
  - PRs appear with a status dot on the right of each row.
EOF
