#!/usr/bin/env bash
# Point this clone at the tracked .githooks/ directory.
# Run once per fresh clone. spawn-agent.sh runs it automatically for new worktrees.

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

git config core.hooksPath .githooks

echo "✓ core.hooksPath = .githooks"
echo ""
echo "Active hooks:"
ls -1 .githooks
