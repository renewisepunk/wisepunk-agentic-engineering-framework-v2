#!/usr/bin/env bash
# One-stop script to run after pulling main.
#
# Usage:
#   bash tools/post-pull.sh
#
# What it does:
#   1. Checks if a dependency manifest/lockfile changed vs ORIG_HEAD.
#      If so, reminds you to run your package manager's install.
#
# Extend this script as new "pull hygiene" checks are identified for your stack
# (e.g. backend codegen freshness, schema regeneration). Keep each check
# idempotent and non-blocking.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

needs_attention=false

# ── Dep drift check ──────────────────────────────────────────────────────────
# Stack-agnostic: covers the common JS package managers by default. Add your
# ecosystem's manifests/lockfiles here if different (e.g. requirements.txt,
# poetry.lock, go.mod, go.sum, Cargo.toml, Cargo.lock, Gemfile.lock).
DEP_FILES='(^|/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb)$'

changed_deps=$(git diff --name-only ORIG_HEAD HEAD 2>/dev/null \
  | grep -E "$DEP_FILES" \
  || true)

if [ -n "$changed_deps" ]; then
  echo "📦  Dependencies changed — run your install command (e.g. pnpm install / npm install)" >&2
  needs_attention=true
fi

# ── Add more pull-hygiene checks here (stack-specific) ────────────────────────
# Example (Convex): regenerate codegen if convex/ changed
#   if git diff --name-only ORIG_HEAD HEAD | grep -q '^convex/'; then
#     echo "🔁  Backend changed — consider re-running codegen" >&2
#     needs_attention=true
#   fi

# ─────────────────────────────────────────────────────────────────────────────
if [ "$needs_attention" = "false" ]; then
  echo "✓  post-pull checks passed — nothing to do"
fi
