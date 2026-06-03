#!/usr/bin/env bash
# Install the Wisepunk Agentic Engineering Framework into the current project.
#
# Usage (interactive):
#   bash /path/to/waef/framework/tools/install.sh
#
# Usage (non-interactive — for CI or scripted installs):
#   bash /path/to/waef/framework/tools/install.sh \
#       --team "Acme" --prefix "ACM" [--target /path/to/project] [--yes]
#
# Or from a clone:
#   git clone https://github.com/renewisepunk/wisepunk-agentic-engineering-framework-v2 /tmp/waef
#   bash /tmp/waef/framework/tools/install.sh
#
# What it does:
#   1. Copies framework/ai/ → your repo's ai/
#   2. Copies framework/.claude/skills/ → your repo's .claude/skills/
#      (native Claude Code skill discovery — invocable as /new-feature, etc.)
#   3. Merges framework/tools/ into your repo's tools/
#   4. Copies framework/.githooks/ → your repo's .githooks/
#   5. Copies framework/AGENTS.md and framework/CLAUDE.md to your repo root
#   6. Copies framework/.github/workflows/ci.template.yml → .github/workflows/ci.yml
#   7. Prompts for ISSUE_PREFIX (e.g. ACM) and substitutes it into templates
#   8. Adds reminders for .gitignore additions
#
# Non-destructive: asks before overwriting any existing file
# (unless --yes is passed, which overwrites without asking).

set -euo pipefail

# --- arg parsing -----------------------------------------------------------

TEAM_NAME=""
ISSUE_PREFIX=""
TARGET_DIR="$(pwd)"
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team)   TEAM_NAME="$2"; shift 2 ;;
    --prefix) ISSUE_PREFIX="$2"; shift 2 ;;
    --target) TARGET_DIR="$(cd "$2" && pwd)"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --help|-h)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Locate the framework directory (where this script lives, minus /tools)
FRAMEWORK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Wisepunk Agentic Engineering Framework — installer"
echo "  Framework source: $FRAMEWORK_DIR"
echo "  Target project:   $TARGET_DIR"
echo ""

if [[ ! -d "$TARGET_DIR/.git" ]]; then
  if [[ $ASSUME_YES -eq 1 ]]; then
    echo "Target is not a git repository; proceeding due to --yes."
  else
    read -r -p "Target is not a git repository. Continue anyway? [y/N] " yn
    case "$yn" in
      [yY]*) ;;
      *) echo "aborted"; exit 1 ;;
    esac
  fi
fi

# --- helpers ---------------------------------------------------------------

# Copy a file, asking before overwriting (unless --yes)
copy_file() {
  local src="$1"
  local dest="$2"
  if [[ -f "$dest" ]]; then
    if [[ $ASSUME_YES -eq 1 ]]; then
      cp "$src" "$dest"
      echo "  ~ $dest (overwritten)"
      return
    fi
    read -r -p "  $dest exists. Overwrite? [y/N] " yn
    case "$yn" in
      [yY]*) cp "$src" "$dest"; echo "    overwritten" ;;
      *) echo "    skipped" ;;
    esac
  else
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "  + $dest"
  fi
}

# Copy a directory tree, asking before overwriting files
copy_dir() {
  local src="$1"
  local dest="$2"
  if [[ ! -d "$src" ]]; then return; fi
  find "$src" -type f | while read -r f; do
    rel="${f#$src/}"
    copy_file "$f" "$dest/$rel"
  done
}

# --- prompt for config (interactive only) ----------------------------------

if [[ -z "$TEAM_NAME" ]]; then
  read -r -p "  Linear team name (e.g. Acme): " TEAM_NAME
fi
if [[ -z "$ISSUE_PREFIX" ]]; then
  read -r -p "  Linear issue prefix (e.g. ACM): " ISSUE_PREFIX
fi

if [[ -z "$TEAM_NAME" || -z "$ISSUE_PREFIX" ]]; then
  echo "Both --team and --prefix required. Aborting." >&2
  exit 1
fi

echo ""
echo "  Using: team=$TEAM_NAME, prefix=$ISSUE_PREFIX"
echo ""

# --- copy ai/ --------------------------------------------------------------
echo "Copying ai/ ..."
copy_dir "$FRAMEWORK_DIR/ai" "$TARGET_DIR/ai"

# --- copy .claude/skills/ (NATIVE Claude Code skill discovery) -------------
echo "Copying .claude/skills/ ..."
copy_dir "$FRAMEWORK_DIR/.claude/skills" "$TARGET_DIR/.claude/skills"

# --- copy tools/ -----------------------------------------------------------
echo "Copying tools/ ..."
copy_dir "$FRAMEWORK_DIR/tools" "$TARGET_DIR/tools"
# Make scripts executable
chmod +x "$TARGET_DIR/tools/"*.sh 2>/dev/null || true
chmod +x "$TARGET_DIR/tools/"*.mjs 2>/dev/null || true

# --- copy .githooks/ -------------------------------------------------------
echo "Copying .githooks/ ..."
copy_dir "$FRAMEWORK_DIR/.githooks" "$TARGET_DIR/.githooks"
chmod +x "$TARGET_DIR/.githooks/"* 2>/dev/null || true

# --- copy AGENTS.md / CLAUDE.md --------------------------------------------
echo "Copying root files ..."
copy_file "$FRAMEWORK_DIR/AGENTS.md" "$TARGET_DIR/AGENTS.md"
copy_file "$FRAMEWORK_DIR/CLAUDE.md" "$TARGET_DIR/CLAUDE.md"

# --- copy CI workflow ------------------------------------------------------
echo "Copying CI workflow ..."
copy_file "$FRAMEWORK_DIR/.github/workflows/ci.template.yml" "$TARGET_DIR/.github/workflows/ci.yml"

# --- substitute templates --------------------------------------------------
echo ""
echo "Substituting {ISSUE_PREFIX} → $ISSUE_PREFIX and {TEAM_NAME} → $TEAM_NAME in templates..."
for f in \
  "$TARGET_DIR/AGENTS.md" \
  "$TARGET_DIR/ai/templates/plan.md" \
  "$TARGET_DIR/ai/checklists/plan.md" \
  "$TARGET_DIR/.claude/skills/new-feature/SKILL.md" \
  "$TARGET_DIR/.claude/skills/ship-feature/SKILL.md" \
; do
  if [[ -f "$f" ]]; then
    sed -i.bak "s/{ISSUE_PREFIX}/$ISSUE_PREFIX/g; s/{TEAM_NAME}/$TEAM_NAME/g" "$f"
    rm -f "$f.bak"
    echo "  $f"
  fi
done

# Rename the CONTEXT template if no CONTEXT.md exists yet
if [[ -f "$TARGET_DIR/ai/CONTEXT.template.md" && ! -f "$TARGET_DIR/ai/CONTEXT.md" ]]; then
  mv "$TARGET_DIR/ai/CONTEXT.template.md" "$TARGET_DIR/ai/CONTEXT.md"
  echo "  Renamed ai/CONTEXT.template.md → ai/CONTEXT.md (fill it in!)"
fi

# --- post-install reminders ------------------------------------------------
cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║                         INSTALL COMPLETE                             ║
╚══════════════════════════════════════════════════════════════════════╝

Skills installed at .claude/skills/ — invocable in Claude Code as:
  /new-feature  /ship-feature  /independent-review
  /security-review  /efficiency-review

Next steps:

  1. Fill in ai/CONTEXT.md with your project details

  2. Customize ai/STANDARDS.md for your stack (delete what doesn't apply)

  3. Get a Linear API key:
     https://linear.app/settings/account/security → Personal API keys
     Add to .env.local:
        LINEAR_API_KEY=lin_api_xxxxx

  4. Verify:
     node tools/linear-cli.mjs list --team $TEAM_NAME --state Backlog --limit 5

  5. Activate the pre-push merge gate:
     bash tools/setup-hooks.sh

  6. Customize tools/bootstrap-worktree-backend.sh for your backend
     (Convex / Supabase / Neon / Vercel — see docs/08-customizing.md)

  7. Open Claude Code in this project and confirm the skills loaded:
     claude
     > /help    # should show /new-feature etc. under "Project skills"

  8. Ship your first feature:
     > /new-feature $ISSUE_PREFIX-1

  Full guide: see GETTING_STARTED.md in the framework repo.

EOF
