#!/usr/bin/env node
// Minimal Linear CLI using the REST/GraphQL API + a personal API key.
// Used by /new-feature and /ship-feature skills as a reliable alternative to the
// claude.ai Linear MCP, which doesn't pass through to background sessions cleanly.
//
// Auth: reads LINEAR_API_KEY from .env.local (or process env).
// Get one at https://linear.app/settings/account/security → Personal API keys → New API key.
//
// Usage (replace ACM-90 with your team's issue prefix):
//   node tools/linear-cli.mjs get ACM-90
//   node tools/linear-cli.mjs claim ACM-90 --email you@yourorg.com
//   node tools/linear-cli.mjs comment ACM-90 --body "Plan posted at ai/runs/..."
//   node tools/linear-cli.mjs close ACM-90
//   node tools/linear-cli.mjs list --team Acme --state Backlog --unassigned --limit 20
//   node tools/linear-cli.mjs deps ACM-90
//
// All commands print JSON to stdout. Errors go to stderr with exit code 1.

import fs from "node:fs";
import path from "node:path";

const LINEAR_API = "https://api.linear.app/graphql";

function loadApiKey() {
  if (process.env.LINEAR_API_KEY) return process.env.LINEAR_API_KEY;
  // Walk up from cwd looking for .env.local
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const f = path.join(dir, ".env.local");
    if (fs.existsSync(f)) {
      const line = fs.readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("LINEAR_API_KEY="));
      if (line) return line.slice("LINEAR_API_KEY=".length).trim();
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const API_KEY = loadApiKey();
if (!API_KEY) {
  console.error("ERROR: LINEAR_API_KEY not set in env or .env.local");
  console.error("       Get a key from https://linear.app/settings/account/security");
  process.exit(1);
}

async function gql(query, variables = {}) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("Linear API error:", JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

async function cmdGet(issueId) {
  const data = await gql(
    `query($id: String!) {
      issue(id: $id) {
        id identifier title description
        state { name type }
        assignee { id name email }
        team { id name }
        url
        parent { identifier }
      }
    }`,
    { id: issueId },
  );
  if (!data.issue) {
    console.error(`Issue ${issueId} not found`);
    process.exit(1);
  }
  console.log(JSON.stringify(data.issue, null, 2));
}

async function cmdClaim(issueId, email) {
  // 1. Get issue + its team
  const issueData = await gql(
    `query($id: String!) { issue(id: $id) { id assignee { email } team { id } state { name } } }`,
    { id: issueId },
  );
  const issue = issueData.issue;
  if (!issue) { console.error(`Issue ${issueId} not found`); process.exit(1); }

  // 2. Race-safe: if already assigned to someone else, abort
  if (issue.assignee && issue.assignee.email && issue.assignee.email !== email) {
    console.error(`ABORT: ${issueId} is already assigned to ${issue.assignee.email}`);
    process.exit(2);
  }

  // 3. Resolve user ID for email
  const userData = await gql(
    `query($email: String!) { users(filter: { email: { eq: $email } }) { nodes { id email } } }`,
    { email },
  );
  const user = userData.users.nodes[0];
  if (!user) { console.error(`User with email ${email} not found in Linear workspace`); process.exit(1); }

  // 4. Find "In Progress" state ID for this team
  const stateData = await gql(
    `query($teamId: String!) { team(id: $teamId) { states { nodes { id name type } } } }`,
    { teamId: issue.team.id },
  );
  const inProgress = stateData.team.states.nodes.find((s) => s.type === "started");
  if (!inProgress) { console.error(`No "started" state found for team`); process.exit(1); }

  // 5. Update issue
  const update = await gql(
    `mutation($id: String!, $assigneeId: String!, $stateId: String!) {
       issueUpdate(id: $id, input: { assigneeId: $assigneeId, stateId: $stateId }) {
         success issue { id assignee { email } state { name } }
       }
     }`,
    { id: issue.id, assigneeId: user.id, stateId: inProgress.id },
  );
  if (!update.issueUpdate.success) { console.error("issueUpdate returned success=false"); process.exit(1); }

  // 6. Re-read to confirm (race check)
  const verify = await gql(
    `query($id: String!) { issue(id: $id) { id assignee { email } state { name } } }`,
    { id: issue.id },
  );
  if (verify.issue.assignee?.email !== email) {
    console.error(`Race lost: issue is now assigned to ${verify.issue.assignee?.email}`);
    process.exit(2);
  }
  console.log(JSON.stringify(verify.issue, null, 2));
}

async function cmdComment(issueId, body) {
  const issueData = await gql(`query($id: String!) { issue(id: $id) { id } }`, { id: issueId });
  if (!issueData.issue) { console.error(`Issue ${issueId} not found`); process.exit(1); }
  const result = await gql(
    `mutation($issueId: String!, $body: String!) {
       commentCreate(input: { issueId: $issueId, body: $body }) { success comment { id url } }
     }`,
    { issueId: issueData.issue.id, body },
  );
  if (!result.commentCreate.success) { console.error("commentCreate returned success=false"); process.exit(1); }
  console.log(JSON.stringify(result.commentCreate.comment, null, 2));
}

async function cmdClose(issueId) {
  const issueData = await gql(`query($id: String!) { issue(id: $id) { id team { id } } }`, { id: issueId });
  if (!issueData.issue) { console.error(`Issue ${issueId} not found`); process.exit(1); }
  const stateData = await gql(
    `query($teamId: String!) { team(id: $teamId) { states { nodes { id name type } } } }`,
    { teamId: issueData.issue.team.id },
  );
  const done = stateData.team.states.nodes.find((s) => s.type === "completed");
  if (!done) { console.error("No completed state found"); process.exit(1); }
  const result = await gql(
    `mutation($id: String!, $stateId: String!) {
       issueUpdate(id: $id, input: { stateId: $stateId }) { success issue { id state { name } } }
     }`,
    { id: issueData.issue.id, stateId: done.id },
  );
  if (!result.issueUpdate.success) { console.error("issueUpdate returned success=false"); process.exit(1); }
  console.log(JSON.stringify(result.issueUpdate.issue, null, 2));
}

// Returns blockedBy issue identifiers + raw description for the given issue.
// Used by dispatch-batch.sh pre-flight to detect intra-batch dependencies.
// Exits with code 0 and empty blockedBy array on API error (fail-open).
async function cmdDeps(issueId) {
  let data;
  try {
    data = await gql(
      `query($id: String!) {
        issue(id: $id) {
          identifier
          description
          relations(first: 50) {
            nodes { type relatedIssue { identifier } }
          }
        }
      }`,
      { id: issueId },
    );
  } catch {
    console.log(JSON.stringify({ identifier: issueId, blockedBy: [], description: "" }));
    return;
  }
  if (!data.issue) {
    console.log(JSON.stringify({ identifier: issueId, blockedBy: [], description: "" }));
    return;
  }
  const blockedBy = (data.issue.relations?.nodes ?? [])
    .filter((r) => r.type === "blocked_by" && r.relatedIssue)
    .map((r) => r.relatedIssue.identifier);
  console.log(JSON.stringify({
    identifier: data.issue.identifier,
    blockedBy,
    description: data.issue.description ?? "",
  }));
}

async function cmdList({ team, state, unassigned, limit }) {
  // Resolve team ID
  const teamData = await gql(`query { teams(first: 50) { nodes { id name key } } }`);
  const t = teamData.teams.nodes.find((x) => x.name === team || x.key === team);
  if (!t) { console.error(`Team ${team} not found`); process.exit(1); }

  const filter = {};
  if (state) filter.state = { name: { eq: state } };
  if (unassigned) filter.assignee = { null: true };
  filter.team = { id: { eq: t.id } };

  const data = await gql(
    `query($filter: IssueFilter, $first: Int!) {
       issues(filter: $filter, first: $first, orderBy: updatedAt) {
         nodes { identifier title state { name } assignee { email } updatedAt }
       }
     }`,
    { filter, first: parseInt(limit || "20", 10) },
  );
  console.log(JSON.stringify(data.issues.nodes, null, 2));
}

// Dispatch
const [, , cmd, ...rest] = process.argv;
const { flags, positional } = parseFlags(rest);

switch (cmd) {
  case "get": {
    const [id] = positional;
    if (!id) { console.error("Usage: linear-cli get <issueId>"); process.exit(1); }
    await cmdGet(id);
    break;
  }
  case "claim": {
    const [id] = positional;
    if (!id || !flags.email) { console.error("Usage: linear-cli claim <issueId> --email <email>"); process.exit(1); }
    await cmdClaim(id, flags.email);
    break;
  }
  case "comment": {
    const [id] = positional;
    if (!id || !flags.body) { console.error("Usage: linear-cli comment <issueId> --body <text>"); process.exit(1); }
    await cmdComment(id, flags.body);
    break;
  }
  case "close": {
    const [id] = positional;
    if (!id) { console.error("Usage: linear-cli close <issueId>"); process.exit(1); }
    await cmdClose(id);
    break;
  }
  case "list": {
    if (!flags.team) { console.error("Usage: linear-cli list --team <name> [--state X] [--unassigned] [--limit 20]"); process.exit(1); }
    await cmdList(flags);
    break;
  }
  case "deps": {
    const [id] = positional;
    if (!id) { console.error("Usage: linear-cli deps <issueId>"); process.exit(1); }
    await cmdDeps(id);
    break;
  }
  default:
    console.error("Commands: get | claim | comment | close | list | deps");
    process.exit(1);
}
