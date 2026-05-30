#!/usr/bin/env node
// Validation gate classifier.
//
// Reads ai/gates.config.mjs + the current diff + the run's plan.md.
// Produces ai/runs/<run>/gates.manifest.json declaring which gates run for this PR.
//
// Usage:
//   node tools/gate-classifier.mjs --run ai/runs/2026-05-28_ACM-42_name
//   node tools/gate-classifier.mjs --run <path> --base origin/main
//   node tools/gate-classifier.mjs --run <path> --json   # print manifest to stdout only
//
// Exit codes:
//   0 — manifest written
//   1 — config or runtime error
//   2 — discrepancies between file-pattern triggers and plan declarations
//       (caller should run the semantic LLM override step)

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const args = parseArgs(process.argv.slice(2));
if (!args.run) {
  console.error("ERROR: --run <path-to-run-folder> is required");
  process.exit(1);
}

const RUN_DIR = path.resolve(args.run);
const BASE = args.base || "origin/main";
const HEAD = args.head || "HEAD";

const repoRoot = findRepoRoot(RUN_DIR);
const configPath = path.join(repoRoot, "ai", "gates.config.mjs");
if (!fs.existsSync(configPath)) {
  console.error(`ERROR: ai/gates.config.mjs not found at ${configPath}`);
  process.exit(1);
}

const { default: config } = await import(pathToFileURL(configPath).href);
const gates = config.gates || {};

const planPath = path.join(RUN_DIR, "plan.md");
if (!fs.existsSync(planPath)) {
  console.error(`ERROR: ${planPath} does not exist`);
  process.exit(1);
}
const planDeclarations = parsePlanGateScope(fs.readFileSync(planPath, "utf8"));

const changedFiles = listChangedFiles(BASE, HEAD, repoRoot);

const manifest = {
  timestamp: new Date().toISOString(),
  base: BASE,
  head: HEAD,
  changedFiles: changedFiles.length,
  gates: {},
  discrepancies: [],
  needsSemanticReview: false,
};

for (const [name, cfg] of Object.entries(gates)) {
  const filePatternTriggered = isTriggeredByFiles(cfg, changedFiles);
  const declaration = planDeclarations[name];

  let required;
  let reason;

  if (cfg.always) {
    required = true;
    reason = "always-on";
  } else if (declaration?.status === "required") {
    required = true;
    reason = declaration.reason
      ? `plan declared required: ${declaration.reason}`
      : "plan declared required";
  } else if (declaration?.status === "skipped") {
    if (cfg.planOptOutAllowed === false) {
      required = true;
      reason = `gate cannot be skipped via plan (planOptOutAllowed: false). Plan said: ${declaration.reason || "no reason"}`;
      manifest.discrepancies.push({
        gate: name,
        kind: "illegal-opt-out",
        detail: reason,
      });
    } else if (filePatternTriggered.triggered) {
      required = false;
      reason = `skipped per plan: ${declaration.reason || "(no reason given)"} — but file-pattern triggered on ${filePatternTriggered.matchedBy}`;
      manifest.discrepancies.push({
        gate: name,
        kind: "skip-vs-pattern",
        detail: `plan opted out (${declaration.reason || "no reason"}) but diff touched ${filePatternTriggered.matchedBy}`,
      });
    } else {
      required = false;
      reason = `skipped per plan: ${declaration.reason || "(no reason given)"}`;
    }
  } else if (filePatternTriggered.triggered) {
    required = true;
    reason = `triggered by ${filePatternTriggered.matchedBy}`;
  } else {
    required = false;
    reason = "no triggers matched";
  }

  manifest.gates[name] = { required, reason, description: cfg.description };
}

if (manifest.discrepancies.length > 0) manifest.needsSemanticReview = true;

const outPath = path.join(RUN_DIR, "gates.manifest.json");
if (!args.json) {
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));
}

printSummary(manifest, outPath, args.json);
process.exit(manifest.needsSemanticReview ? 2 : 0);

// --- helpers ---

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--run") out.run = argv[++i];
    else if (a === "--base") out.base = argv[++i];
    else if (a === "--head") out.head = argv[++i];
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    }
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node tools/gate-classifier.mjs --run <run-folder> [--base <ref>] [--head <ref>] [--json]

Required:
  --run <path>    Path to the run folder (must contain plan.md)

Optional:
  --base <ref>    Git ref to diff against (default: origin/main)
  --head <ref>    Git ref for HEAD (default: HEAD)
  --json          Print manifest to stdout instead of writing to disk

Exit codes:
  0   Manifest written; no discrepancies
  1   Error
  2   Discrepancies found; caller should run semantic LLM review`);
}

function findRepoRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (fs.existsSync(path.join(dir, "ai", "gates.config.mjs"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function listChangedFiles(base, head, cwd) {
  try {
    const out = execSync(`git diff --name-only ${base}...${head}`, {
      cwd,
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean);
  } catch (err) {
    console.error(`WARNING: could not compute diff ${base}...${head}: ${err.message}`);
    console.error("         Falling back to uncommitted changes.");
    const out = execSync("git status --porcelain", { cwd, encoding: "utf8" });
    return out
      .split("\n")
      .filter(Boolean)
      .map((line) => line.slice(3).trim());
  }
}

function isTriggeredByFiles(gateCfg, changedFiles) {
  if (!gateCfg.triggers || gateCfg.triggers.length === 0) {
    return { triggered: false, matchedBy: null };
  }
  const skipExts = gateCfg.skipExtensions || [];
  const candidates = changedFiles.filter(
    (f) => !skipExts.some((ext) => f.endsWith(ext)),
  );
  for (const pattern of gateCfg.triggers) {
    const re = globToRegExp(pattern);
    const hit = candidates.find((f) => re.test(f));
    if (hit) return { triggered: true, matchedBy: `${hit} (matched ${pattern})` };
  }
  return { triggered: false, matchedBy: null };
}

// Minimal glob → regex. Supports *, **, and literal segments.
// Not a full minimatch; intentionally small to keep the framework dep-free.
function globToRegExp(glob) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") {
      re += "[^/]*";
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === ".") {
      re += "\\.";
    } else if ("+()[]{}|^$\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

// Parse the "Gate scope" section of plan.md.
//
// Expected format (any of):
//   - acceptance: required
//   - user-value: required
//   - security: skipped — "schema-only change, no new attack surface"
//   - efficiency: skipped: no hot-path code touched
//
// Returns { acceptance: { status: "required" }, security: { status: "skipped", reason: "..." } }
function parsePlanGateScope(planText) {
  const sectionMatch = planText.match(
    /## Gate scope[\s\S]*?(?=\n## |\n# |$)/i,
  );
  if (!sectionMatch) return {};
  const block = sectionMatch[0];
  const out = {};
  // Use [ \t] (not \s) so the regex never crosses newlines and accidentally
  // captures the next line's content as this line's reason.
  const lineRe = /^[ \t]*[-*][ \t]+([a-z-]+)[ \t]*:[ \t]*(required|skipped)\b[ \t]*[—:-]?[ \t]*([^\n]*)$/gim;
  let m;
  while ((m = lineRe.exec(block)) !== null) {
    const name = m[1].toLowerCase();
    const status = m[2].toLowerCase();
    let reason = (m[3] || "").trim();
    reason = reason.replace(/^["']|["']$/g, "").trim();
    out[name] = { status, reason: reason || null };
  }
  return out;
}

function printSummary(manifest, outPath, jsonOnly) {
  if (jsonOnly) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }
  console.log(`\nGate manifest written to ${path.relative(process.cwd(), outPath)}`);
  console.log(`Diff: ${manifest.base}...${manifest.head} (${manifest.changedFiles} files)\n`);
  for (const [name, g] of Object.entries(manifest.gates)) {
    const flag = g.required ? "✓ run" : "  skip";
    console.log(`  ${flag}  ${name.padEnd(14)} ${g.reason}`);
  }
  if (manifest.discrepancies.length > 0) {
    console.log(
      `\n⚠  ${manifest.discrepancies.length} discrepancy(ies) between plan and file-pattern triggers.`,
    );
    console.log("   Caller should run semantic LLM override step.");
    for (const d of manifest.discrepancies) {
      console.log(`   - [${d.gate}] ${d.kind}: ${d.detail}`);
    }
  }
}
