#!/usr/bin/env node
/**
 * migrate-knowledge-frontmatter.mjs — add YAML frontmatter to all pitfall and
 * pattern files that are missing it (or missing required fields).
 *
 * Conforms to the frontmatter convention documented in
 * ai/knowledge/{pitfalls,patterns}/README.md:
 *   title / tags / related / created / last_referenced
 *
 * One-shot, idempotent migration: safe to re-run — skips files that already
 * have complete frontmatter, and patches files that have partial frontmatter.
 *
 * Usage: node tools/migrate-knowledge-frontmatter.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, basename } from "path";

const STOPWORDS = new Set([
  "a", "an", "the", "on", "in", "for", "with", "not", "no", "by",
  "to", "of", "and", "or", "is", "are", "does", "can", "at", "from",
  "that", "this", "it", "its", "be", "as", "if", "when", "has", "have",
  "had", "do", "into", "via", "vs", "use", "using",
]);

const DIRS = [
  "ai/knowledge/pitfalls",
  "ai/knowledge/patterns",
];

const TODAY = new Date().toISOString().slice(0, 10);

const REQUIRED_FIELDS = ["title", "tags", "related", "created", "last_referenced"];

let migrated = 0;
let patched = 0;
let skipped = 0;
let errors = 0;

function tagsFromSlug(slug) {
  return slug
    .replace(/\.md$/, "")
    .split("-")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .slice(0, 8); // cap at 8 tags
}

function titleFromContent(content, slug) {
  // Find first non-blank line that starts with "# "
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      return trimmed.slice(2).trim();
    }
  }
  // Fall back to slug
  return slug.replace(/\.md$/, "").replace(/-/g, " ");
}

function buildFrontmatter(title, tags) {
  const tagList = tags.map((t) => `"${t}"`).join(", ");
  return `---\ntitle: "${title.replace(/"/g, '\\"')}"\ntags: [${tagList}]\nrelated: []\ncreated: ${TODAY}\nlast_referenced: null\n---\n\n`;
}

for (const dir of DIRS) {
  let files;
  try {
    files = readdirSync(dir).filter(
      (f) => f.endsWith(".md") && f !== "README.md"
    );
  } catch (e) {
    console.error(`Cannot read ${dir}: ${e.message}`);
    errors++;
    continue;
  }

  for (const file of files) {
    const path = join(dir, file);
    let content;
    try {
      content = readFileSync(path, "utf8");
    } catch (e) {
      console.error(`Cannot read ${path}: ${e.message}`);
      errors++;
      continue;
    }

    const slug = basename(file);

    // If file already has frontmatter, check if all required fields are present
    if (content.trimStart().startsWith("---")) {
      const stripped = content.trimStart().slice(3);
      const closeIdx = stripped.indexOf("\n---");
      if (closeIdx !== -1) {
        const fmBlock = stripped.slice(0, closeIdx);
        const presentKeys = new Set(
          fmBlock.split("\n")
            .filter((l) => l.includes(":"))
            .map((l) => l.split(":")[0].trim())
        );
        const missing = REQUIRED_FIELDS.filter((k) => !presentKeys.has(k));
        if (missing.length === 0) {
          skipped++;
          continue;
        }
        // Patch: add missing fields before closing ---
        const additions = [];
        if (!presentKeys.has("title")) {
          const titleVal = titleFromContent(content, slug);
          additions.push(`title: "${titleVal.replace(/"/g, '\\"')}"`);
        }
        if (!presentKeys.has("tags")) {
          const tags = tagsFromSlug(slug);
          additions.push(`tags: [${tags.map((t) => `"${t}"`).join(", ")}]`);
        }
        if (!presentKeys.has("related")) additions.push("related: []");
        if (!presentKeys.has("created")) additions.push(`created: ${TODAY}`);
        if (!presentKeys.has("last_referenced")) additions.push("last_referenced: null");

        const newFm = fmBlock.trimEnd() + "\n" + additions.join("\n");
        const rest = stripped.slice(closeIdx);
        const newContent = "---\n" + newFm + rest;
        try {
          writeFileSync(path, newContent, "utf8");
          patched++;
        } catch (e) {
          console.error(`Cannot patch ${path}: ${e.message}`);
          errors++;
        }
        continue;
      }
      skipped++;
      continue;
    }

    const title = titleFromContent(content, slug);
    const tags = tagsFromSlug(slug);
    const frontmatter = buildFrontmatter(title, tags);

    try {
      writeFileSync(path, frontmatter + content, "utf8");
      migrated++;
    } catch (e) {
      console.error(`Cannot write ${path}: ${e.message}`);
      errors++;
    }
  }
}

console.log(`Migration complete: ${migrated} migrated, ${patched} patched (had partial frontmatter), ${skipped} already complete, ${errors} errors.`);
if (errors > 0) process.exit(1);
