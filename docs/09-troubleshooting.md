# 09 — Troubleshooting

Common failure modes and their fixes. Organized by symptom.

---

## Linear CLI

### `LINEAR_API_KEY not set in env or .env.local`

- You're not in a directory that has `.env.local` (the CLI walks up 5 dirs looking for it).
- The key in `.env.local` is on a line that doesn't start with `LINEAR_API_KEY=` (whitespace, comment, etc.).
- Fix: `grep LINEAR_API_KEY .env.local` from your repo root. Should print exactly one line.

### `ABORT: ACM-42 is already assigned to <other-email>`

This is the lock working — another agent claimed it first.

- If you intended to claim: pick another issue.
- If the assignment is stale (the agent died without unassigning): manually unassign in Linear, then re-run.

### `Race lost: issue is now assigned to <email>`

Same as above, but the race happened between your read and write. Two agents tried at the exact same moment. Try another issue.

### `User with email X not found in Linear workspace`

`git config user.email` returns an address that isn't a Linear member.

- Fix one: `git config user.email rene@yourorg.com` (using your real Linear-member email).
- Fix two: invoke claim with explicit email: `linear-cli claim ACM-42 --email rene@yourorg.com`.

### `comment` works but no comment appears in Linear UI

Linear caches the issue view. Refresh the page; the comment is there.

---

## Worktrees + bootstrap

### `ERROR: not in a worktree`

`bootstrap-worktree-backend.sh` refuses to run in the main repo (it would mutate your real `.env.local`). Either:

- `cd .claude/worktrees/<name>` first
- Or you're meant to be running this from the worktree, not the main repo. Check `pwd`.

### `ERROR: branch already exists: agent/ACM-42-foo`

You ran `spawn-agent.sh` once, it failed partway, and now the branch exists but the worktree doesn't (or vice versa). Clean up:

```bash
git worktree remove .claude/worktrees/ACM-42-foo --force 2>/dev/null
git branch -D agent/ACM-42-foo 2>/dev/null
```

Then re-run.

### `ERROR: .env.local missing required key: CONVEX_PREVIEW_DEPLOY_KEY` (or equivalent)

Your bootstrap script requires a key your `.env.local` doesn't have. Either:

- Add the key.
- Edit `bootstrap-worktree-backend.sh` to remove the requirement (if you're not using that backend).

### Preview deployment creation fails

Backend-specific. Most common causes:

- **Wrong key type** — using a dev key where a preview key is expected (Convex's most common gotcha — preview keys start with `preview:`, dev keys with `dev:`).
- **Slot exhaustion** — your backend caps concurrent previews on the free tier. Delete unused previews or upgrade.
- **Network / auth** — try the deploy command manually outside the script to see the raw error.

### Worktree shares the main repo's `.env.local`

The bootstrap script *copies* `.env.local` into the worktree and *appends* per-branch overrides. If you edit the main repo's `.env.local` after bootstrap, the worktree doesn't see the change. Either:

- Re-copy: `cp .env.local .claude/worktrees/<name>/.env.local` then re-append worktree-specific lines.
- Or edit both files in parallel.

---

## Agent View / Background sessions

### Background session stuck on "Needs input"

The agent hit a tool-permission prompt. Open Agent View, attach to the session, approve (or deny) the prompt.

To avoid this: dispatch with `--permission-mode auto` (which `dispatch-batch.sh` does by default). Risky operations still pause.

### Background session died without explanation

- Check the session's transcript via Agent View's peek panel.
- Common causes: out-of-memory (very large diffs), upstream API errors (Anthropic rate limit), or a malformed skill that crashes the session.
- Restart with the same issue: the skill detects partial bootstrap (claim was made, plan was written) and resumes.

### `claude --bg` fails with "auto permission mode not previously accepted"

You haven't accepted auto-mode interactively once. Fix:

```bash
claude --permission-mode auto
# accept the prompt; exit the session
# then dispatch-batch.sh will work
```

---

## CI

### CI fails on a `tsc` error that doesn't reproduce locally

- Stale `node_modules` — `rm -rf node_modules pnpm-lock.yaml && pnpm install`.
- TypeScript version mismatch — check `package.json` matches the version CI installs.
- Codegen drift — if you edited a schema but didn't regenerate, `_generated/` is out of date. Re-run your codegen command.

### CI passes but the deployed app crashes

Tests caught the wrong thing. The fix is layer 2 (smoke) tests — see [06-testing-and-ci.md](./06-testing-and-ci.md). Tests should exercise the running system, not just the types.

### Lint fails on a file the PR didn't touch

The lint runner's "changed files" detection is wrong. Common cause: the diff includes a merge commit that "touches" everything. Either:

- Rebase to remove the merge commit.
- Add a path filter to the lint step to exclude generated/vendored dirs.

### Pre-push hook blocks `git push origin main`

That's the hook working. Open a PR instead. Emergency override:

```bash
FORCE_DIRECT_PUSH=1 git push origin main
```

---

## The compound step

### Compound writes a duplicate of an existing pitfall

The framework's dedup is currently honor-system. Fix retroactively:

- Read the new pitfall, find the older one, merge content into the older file.
- Delete the new file.
- Note in the run's `compound.md` that the entry was merged.

To prevent: the agent should `ls ai/knowledge/pitfalls/` and grep before writing. The skill's compound step has this check; if it's getting skipped, sharpen the skill's wording.

### Compound writes vague pitfalls ("be careful with X")

The agent is going through the motions. Coach with examples — point at a known-good pitfall (one that names the symptom, root cause, and fix concretely) and ask the agent to rewrite to that level.

If this happens often, add a checklist item to `ai/checklists/review.md`: "Does the compound step name a specific symptom + root cause + fix?"

### Compound doesn't run

`/ship-feature` Step 5 (compound) was skipped because the agent decided "no new learnings." Sometimes true — but check by reading the worklog. If there were any deviations from the plan, any surprises, any decisions not in the plan — there's something to capture.

---

## Three-Surface Rule

### "This issue is internal, Three-Surface doesn't apply" but it actually does

Common when an issue describes a backend helper that's actually user-callable via a chat tool. Re-read the issue title: if a user could ever ask for this in chat, the rule applies.

When in doubt, fill in the Three-Surface table anyway — overshooting is cheaper than undershooting.

### Wire-up forgotten on one surface

`/ship-feature` Step 5's Three-Surface check should catch this. If it doesn't, sharpen the checklist:

```markdown
- [ ] UI surface: component renders, form submits, data appears in DB
- [ ] AI chat: tool is wired in app/api/chat/, prompt the agent to invoke it conversationally, verify result
- [ ] CLI/API: curl the HTTP route, verify response shape
```

Each item must be *verified*, not just *believed*.

### Manifest drift (actions.md says X but code doesn't have it)

You don't have an auto-validator yet (PAU-178 in Paul9's reference is building one). Until then, audit manually: every quarter, walk through `ai/knowledge/actions.md` and grep for each entry's chat tool / route / UI page.

---

## Performance

### Dispatching N agents makes everything slow

You're sharing Claude subscription quota, backend preview slots, GitHub Actions minutes. Each agent independently consumes all three.

- Reduce concurrent agents.
- Upgrade subscription tier(s).
- Cache more aggressively in CI (the shipped workflow caches pnpm; add others as needed).

### Convex preview deployments slow to create

First preview after a code change is slow because functions are deploying. Subsequent ones reuse cached output. Patience; or pre-warm by deploying main first.

### `node_modules` blows out disk usage

Each worktree has its own `node_modules` symlink (or fresh copy, depending on pnpm config). With 10 worktrees, that's 10× the inodes. Configure pnpm with `node-linker=hoisted` or `link-workspace-packages=true` to dedupe.

---

## When all else fails

1. **Read the run folder.** `plan.md` says what was intended. `worklog.md` says what actually happened. `review.md` says what was found. `compound.md` says what was learned.

2. **Re-read the skill file.** `.agents/skills/<name>/SKILL.md` is the source of truth for what the skill *should* do. If the agent's behavior diverges, the skill needs sharpening.

3. **Check pitfalls.** `ls ai/knowledge/pitfalls/` and read anything whose name hints at relevance. Often the answer is already there.

4. **Open an issue.** https://github.com/renewisepunk/wisepunk-agentic-engineering-framework/issues — describe what you did, what you expected, what happened. PRs welcome.
