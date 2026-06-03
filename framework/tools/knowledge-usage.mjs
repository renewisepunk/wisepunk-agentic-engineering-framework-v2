#!/usr/bin/env node
/**
 * knowledge-usage.mjs — report on pitfall and pattern usage across plan.md files.
 *
 * Prints three sections:
 *   1. Never referenced — files with last_referenced: null
 *   2. High frequency (last 30 days) — files mentioned >5 times in ai/runs/*\/plan.md
 *   3. Tag distribution — each tag and how many files carry it
 *
 * Relies on the knowledge frontmatter convention documented in
 * ai/knowledge/{pitfalls,patterns}/README.md (title/tags/related/created/last_referenced),
 * and scans the "## Context consulted" section of each ai/runs/<run>/plan.md.
 *
 * Usage: node tools/knowledge-usage.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const DIRS = ["ai/knowledge/pitfalls", "ai/knowledge/patterns"];
const RUNS_DIR = "ai/runs";
const HIGH_FREQ_THRESHOLD = 5;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// --- Frontmatter parser ---

function parseFrontmatter(content) {
  if (!content.trimStart().startsWith("---")) return null;
  const after = content.trimStart().slice(3);
  const end = after.indexOf("\n---");
  if (end === -1) return null;
  const yaml = after.slice(0, end);
  const result = {};
  for (const line of yaml.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (value === "null") {
      result[key] = null;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      result[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      result[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

// --- Collect all knowledge files ---

const knowledgeFiles = []; // { path, name, dir, frontmatter }

for (const dir of DIRS) {
  let files;
  try {
    files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") && f !== "README.md"
    );
  } catch {
    console.error(`Warning: cannot read ${dir}`);
    continue;
  }

  for (const file of files) {
    const path = join(dir, file);
    let content;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      console.error(`Warning: cannot read ${path}`);
      continue;
    }
    const fm = parseFrontmatter(content);
    knowledgeFiles.push({ path, name: file, dir, frontmatter: fm });
  }
}

// --- Scan plan.md files for "Context consulted" mentions ---

const mentionCounts = {}; // filename → count
const recentMentionCounts = {}; // filename → count (last 30 days)
const now = Date.now();

let runDirs;
try {
  runDirs = readdirSync(RUNS_DIR);
} catch {
  runDirs = [];
}

for (const runDir of runDirs) {
  const planPath = join(RUNS_DIR, runDir, "plan.md");
  let planContent;
  try {
    planContent = readFileSync(planPath, "utf8");
  } catch {
    continue;
  }

  // Determine run date from folder name (YYYY-MM-DD prefix)
  const dateMatch = runDir.match(/^(\d{4}-\d{2}-\d{2})/);
  const runDate = dateMatch ? new Date(dateMatch[1]).getTime() : 0;
  const isRecent = now - runDate < THIRTY_DAYS_MS;

  // Find "Context consulted" section and extract filenames
  const consultedMatch = planContent.match(
    /## Context consulted[\s\S]*?(?=\n##|\n*$)/
  );
  if (!consultedMatch) continue;

  const section = consultedMatch[0];
  // Match markdown list items and bare filenames like `foo-bar.md` or `- foo-bar.md`
  const fileRefs = section.match(/[\w-]+\.md/g) || [];

  for (const ref of fileRefs) {
    mentionCounts[ref] = (mentionCounts[ref] || 0) + 1;
    if (isRecent) {
      recentMentionCounts[ref] = (recentMentionCounts[ref] || 0) + 1;
    }
  }
}

// --- Section 1: Never referenced ---

const neverReferenced = knowledgeFiles.filter((f) => {
  if (!f.frontmatter) return true; // no frontmatter → unknown, flag it
  return f.frontmatter.last_referenced === null;
});

console.log("## Never referenced\n");
console.log(
  `Files with last_referenced: null — ${neverReferenced.length} total (candidates for deletion)\n`
);
for (const f of neverReferenced.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${f.path}`);
}

// --- Section 2: High frequency (last 30 days) ---

const highFreq = Object.entries(recentMentionCounts)
  .filter(([, count]) => count > HIGH_FREQ_THRESHOLD)
  .sort(([, a], [, b]) => b - a);

console.log(
  `\n## High frequency (last 30 days, >${HIGH_FREQ_THRESHOLD} mentions)\n`
);
console.log(
  "Files referenced >5 times in the last 30 days — candidates for promotion to STANDARDS\n"
);
if (highFreq.length === 0) {
  console.log("  (none)");
} else {
  for (const [name, count] of highFreq) {
    console.log(`  ${count}×  ${name}`);
  }
}

// --- Section 3: Tag distribution ---

const tagCounts = {}; // tag → count
for (const f of knowledgeFiles) {
  const tags = f.frontmatter?.tags || [];
  for (const tag of tags) {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
}

const sortedTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a);

console.log("\n## Tag distribution\n");
console.log(
  `${Object.keys(tagCounts).length} unique tags across ${knowledgeFiles.length} files\n`
);
const maxWidth = Math.max(...sortedTags.map(([t]) => t.length), 4);
for (const [tag, count] of sortedTags) {
  const bar = "█".repeat(Math.min(count, 40));
  console.log(`  ${tag.padEnd(maxWidth)}  ${String(count).padStart(3)}  ${bar}`);
}
