#!/usr/bin/env node
// LLM-as-judge eval suite runner.
//
// Reads ai/eval-suites/*.jsonl, runs each case against the feature under test,
// scores the output (structured pre-filter + LLM rubric), writes a report to
// ai/runs/<run>/eval-report.md.
//
// This is a scaffold. The piece you must fill in for your project is the
// `runCase(input)` function — how to actually invoke the feature being evaluated.
// That depends on whether you're testing a chat agent, a search endpoint, a
// ranking function, etc.
//
// Usage:
//   node tools/eval-runner.mjs                          # all suites
//   node tools/eval-runner.mjs --suite search           # one suite
//   node tools/eval-runner.mjs --suite search --filter spain
//   node tools/eval-runner.mjs --ci                     # exits non-zero on regression
//   node tools/eval-runner.mjs --out ai/runs/<run>/eval-report.md
//
// Env:
//   ANTHROPIC_API_KEY   used by the LLM judge (judge model defaults to claude-haiku-4-5)
//   EVAL_BASE_URL       preview backend URL (default: read from .env.local AGENTIC_PREVIEW_URL)
//   EVAL_JUDGE_MODEL    override judge model (default: claude-haiku-4-5)

import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const SUITES_DIR = path.resolve("ai/eval-suites");
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL || "claude-haiku-4-5";
const BASE_URL = process.env.EVAL_BASE_URL || readEnvLocal("AGENTIC_PREVIEW_URL");
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_KEY) {
  console.error("ERROR: ANTHROPIC_API_KEY not set. LLM judge cannot run.");
  process.exit(1);
}
if (!BASE_URL) {
  console.error("WARNING: no preview URL found. runCase() must use the default.");
}

const suites = listSuites(args.suite);
if (suites.length === 0) {
  console.error(`No suites found at ${SUITES_DIR}.`);
  process.exit(1);
}

const results = [];
for (const suite of suites) {
  console.log(`\n=== Running suite: ${suite.name} (${suite.cases.length} cases) ===`);
  for (const tc of suite.cases) {
    if (args.filter && !tc.id.includes(args.filter)) continue;
    if (tc.skip_reason) {
      console.log(`  - ${tc.id}: SKIP (${tc.skip_reason})`);
      results.push({ suite: suite.name, case: tc, status: "skip" });
      continue;
    }
    const r = await runOneCase(suite, tc);
    results.push({ suite: suite.name, case: tc, ...r });
    const flag = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "?";
    console.log(`  ${flag} ${tc.id}: ${r.status} — ${r.summary}`);
  }
}

const report = formatReport(results);
const outPath = args.out || `ai/runs/${currentRunFolder()}/eval-report.md`;
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, report);
console.log(`\nReport: ${outPath}`);

const fails = results.filter((r) => r.status === "fail").length;
if (args.ci && fails > 0) {
  console.error(`\n${fails} failing case(s). Exiting non-zero.`);
  process.exit(1);
}

// --- core ---

async function runOneCase(suite, tc) {
  // Step 1: invoke the feature under test (project-specific — fill in below).
  let actual;
  try {
    actual = await runCase(suite.name, tc.input);
  } catch (err) {
    return { status: "error", summary: `invocation failed: ${err.message}`, actual: null };
  }

  // Step 2: structured pre-filter (cheap; skips LLM judge if a hard assertion fails).
  const structural = checkStructural(tc.expected, actual);
  if (!structural.ok) {
    return {
      status: "fail",
      summary: `structural: ${structural.reason}`,
      actual,
      structural,
      llmJudgment: null,
    };
  }

  // Step 3: LLM judge.
  const judgment = await judgeWithLlm(tc.rubric, tc.input, actual);
  return {
    status: judgment.pass ? "pass" : "fail",
    summary: judgment.reason,
    actual,
    structural,
    llmJudgment: judgment,
  };
}

// PROJECT-SPECIFIC: how to invoke the feature being evaluated.
// Wire this to your stack. Examples by feature class:
//
//   suite "search"  → POST $BASE_URL/api/search { q: input.q }
//   suite "agents"  → POST $BASE_URL/api/chat   { message: input.message }
//   suite "ranking" → call the ranking fn directly via an HTTP wrapper
//
// Return the actual output shape your structural checks + LLM judge expect.
async function runCase(suiteName, input) {
  // STUB. Replace per project.
  const url = `${BASE_URL}/api/eval/${suiteName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function checkStructural(expected, actual) {
  if (!expected) return { ok: true, reason: "no structural checks" };
  if (expected.min_results !== undefined) {
    const n = Array.isArray(actual?.results) ? actual.results.length : 0;
    if (n < expected.min_results) {
      return { ok: false, reason: `min_results: got ${n}, want >= ${expected.min_results}` };
    }
  }
  if (expected.must_mention) {
    const blob = JSON.stringify(actual).toLowerCase();
    for (const term of expected.must_mention) {
      if (!blob.includes(term.toLowerCase())) {
        return { ok: false, reason: `must_mention "${term}" not in output` };
      }
    }
  }
  if (expected.must_not_contain) {
    const blob = JSON.stringify(actual).toLowerCase();
    for (const term of expected.must_not_contain) {
      if (blob.includes(term.toLowerCase())) {
        return { ok: false, reason: `must_not_contain "${term}" present` };
      }
    }
  }
  if (expected.tool_called !== undefined) {
    const got = actual?.tool_called ?? null;
    if (got !== expected.tool_called) {
      return { ok: false, reason: `tool_called: got ${got}, want ${expected.tool_called}` };
    }
  }
  if (expected.max_latency_ms !== undefined) {
    const l = actual?.latency_ms ?? 0;
    if (l > expected.max_latency_ms) {
      return { ok: false, reason: `latency: got ${l}ms, want <= ${expected.max_latency_ms}` };
    }
  }
  return { ok: true, reason: "all structural checks passed" };
}

async function judgeWithLlm(rubric, input, actual) {
  const sys = `You judge whether an output meets a rubric. Reply STRICTLY as JSON:
{"pass": true|false, "reason": "<one sentence>"}
Be strict. If unsure, fail.`;
  const user = `Rubric: ${rubric}

Input:
${JSON.stringify(input, null, 2)}

Output:
${JSON.stringify(actual, null, 2).slice(0, 4000)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      max_tokens: 256,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Judge API error ${res.status}: ${body}`);
  }
  const json = await res.json();
  const text = json.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { pass: false, reason: `judge returned non-JSON: ${text.slice(0, 200)}` };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { pass: false, reason: `judge JSON parse failed: ${text.slice(0, 200)}` };
  }
}

// --- io ---

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--suite") out.suite = argv[++i];
    else if (a === "--filter") out.filter = argv[++i];
    else if (a === "--ci") out.ci = true;
    else if (a === "--out") out.out = argv[++i];
  }
  return out;
}

function listSuites(filter) {
  if (!fs.existsSync(SUITES_DIR)) return [];
  return fs
    .readdirSync(SUITES_DIR)
    .filter((f) => f.endsWith(".jsonl"))
    .filter((f) => !filter || f.startsWith(filter))
    .map((f) => {
      const name = f.replace(/\.jsonl$/, "");
      const raw = fs.readFileSync(path.join(SUITES_DIR, f), "utf8");
      const cases = raw
        .split("\n")
        .filter(Boolean)
        .map((line, i) => {
          try {
            return JSON.parse(line);
          } catch {
            console.error(`Skipping malformed line ${i + 1} in ${f}`);
            return null;
          }
        })
        .filter(Boolean);
      return { name, cases };
    });
}

function readEnvLocal(key) {
  try {
    const lines = fs.readFileSync(".env.local", "utf8").split("\n");
    const hit = lines.find((l) => l.startsWith(`${key}=`));
    return hit ? hit.slice(key.length + 1).trim() : null;
  } catch {
    return null;
  }
}

function currentRunFolder() {
  if (!fs.existsSync("ai/runs")) return "eval-standalone";
  const dirs = fs
    .readdirSync("ai/runs")
    .map((d) => ({ d, m: fs.statSync(`ai/runs/${d}`).mtimeMs }))
    .filter((x) => fs.statSync(`ai/runs/${x.d}`).isDirectory())
    .sort((a, b) => b.m - a.m);
  return dirs[0]?.d || "eval-standalone";
}

function formatReport(results) {
  const total = results.length;
  const passes = results.filter((r) => r.status === "pass").length;
  const fails = results.filter((r) => r.status === "fail").length;
  const errors = results.filter((r) => r.status === "error").length;
  const skips = results.filter((r) => r.status === "skip").length;

  let md = `# Eval report\n\n`;
  md += `**Date:** ${new Date().toISOString()}\n`;
  md += `**Total:** ${total} | **Pass:** ${passes} | **Fail:** ${fails} | **Error:** ${errors} | **Skip:** ${skips}\n\n`;
  md += `**Judge model:** ${JUDGE_MODEL}\n`;
  md += `**Base URL:** ${BASE_URL || "(stack default)"}\n\n`;

  const bySuite = {};
  for (const r of results) (bySuite[r.suite] ??= []).push(r);

  for (const [suite, rs] of Object.entries(bySuite)) {
    md += `## ${suite}\n\n`;
    md += `| Case | Status | Detail |\n|---|---|---|\n`;
    for (const r of rs) {
      const flag = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : r.status === "error" ? "!" : "—";
      md += `| ${r.case.id} | ${flag} ${r.status} | ${(r.summary || "").replace(/\|/g, "\\|")} |\n`;
    }
    md += `\n`;
  }

  const failureCases = results.filter((r) => r.status === "fail" || r.status === "error");
  if (failureCases.length) {
    md += `## Failures (detail)\n\n`;
    for (const r of failureCases) {
      md += `### ${r.suite} / ${r.case.id}\n\n`;
      md += `**Rubric:** ${r.case.rubric}\n\n`;
      md += `**Input:** \`${JSON.stringify(r.case.input)}\`\n\n`;
      md += `**Actual:** \`\`\`json\n${JSON.stringify(r.actual, null, 2).slice(0, 1500)}\n\`\`\`\n\n`;
      if (r.llmJudgment) md += `**Judge:** ${r.llmJudgment.reason}\n\n`;
      else if (r.structural) md += `**Structural:** ${r.structural.reason}\n\n`;
    }
  }

  return md;
}
