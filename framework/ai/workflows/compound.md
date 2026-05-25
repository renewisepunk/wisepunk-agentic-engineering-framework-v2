# Workflow: Compound

## Purpose

Extract reusable knowledge from the completed task and feed it back into the system. This is the step that makes every future task easier. Do not skip it.

## Inputs

- The plan: `ai/runs/<run>/plan.md`
- The worklog: `ai/runs/<run>/worklog.md`
- The review: `ai/runs/<run>/review.md`

## Steps

1. **Reflect on the plan.** Answer:
   - What in the plan was wrong, missing, or underspecified?
   - What assumptions turned out to be incorrect?
   - What risks materialized? Were they anticipated?

2. **Reflect on implementation.** Answer:
   - What was harder than expected and why?
   - What decisions were made during implementation that should have been in the plan?
   - Were there recurring friction points?

3. **Reflect on review findings.** Answer:
   - What bugs were found? What was their root cause?
   - Were there patterns in the issues (e.g., always missing error handling for X)?
   - What would have caught these issues earlier?

4. **Dedup check — run before writing any new pitfall or pattern.**

   For each proposed new entry:

   a. Note its proposed tags (derive from the slug: split on `-`, drop stopwords, keep domain nouns/verbs).
   b. List the relevant directory (`ai/knowledge/pitfalls/` or `patterns/`) and parse the `tags:` field from the frontmatter of each file.
   c. Compute tag overlap for each existing file: `score = |intersection| / min(|proposed|, |existing|)`.
   d. Read the top-5 files by overlap score.
   e. If any file describes the same failure mode / pattern at **≥ 0.8 similarity** (your judgment after reading the content): **halt and ask**:
      > "This looks like a duplicate of `<X.md>`. Append to that file, or create new with justification?"
   f. If creating new despite similarity: add `related: [X.md]` to both files.
   g. If appending: add a dated `### YYYY-MM-DD — <short note>` subsection to the existing file. Do not create a new file.

5. **Update the system.** Based on the above, make concrete edits.

   **Pitfalls** (`ai/knowledge/pitfalls/<slug>.md`):
   - For each new failure mode (confirmed non-duplicate by step 4): create a **new file** at `ai/knowledge/pitfalls/<kebab-slug>.md`. Include YAML frontmatter (see `ai/knowledge/pitfalls/README.md`).
   - Never append to a shared file — per-entry files avoid merge conflicts when multiple agents finish in parallel.

   **Patterns** (`ai/knowledge/patterns/<slug>.md`):
   - For each new pattern worth reusing (confirmed non-duplicate by step 4): create a **new file** at `ai/knowledge/patterns/<kebab-slug>.md`. Include YAML frontmatter (see `ai/knowledge/patterns/README.md`).
   - Same per-entry rule as pitfalls.

   **Standards** (`ai/STANDARDS.md`):
   - Add or refine rules if a class of bug suggests a missing standard.

   **Checklists** (`ai/checklists/`):
   - Add new checklist items if the review caught something the checklist didn't.

   **Decisions** (`ai/knowledge/decisions/`):
   - If a significant architectural decision was made, record it as an ADR.

6. **Write the compound record.** Summarize what was captured in `ai/runs/<run>/compound.md`.

## Output

- New file(s) in `ai/knowledge/pitfalls/` (if applicable)
- New file(s) in `ai/knowledge/patterns/` (if applicable)
- Updated `ai/STANDARDS.md` (if applicable)
- Updated `ai/checklists/*.md` (if applicable)
- New ADR in `ai/knowledge/decisions/` (if applicable)
- `ai/runs/<run>/compound.md` summarizing changes

## Quality check

The compound step is done when you can answer "yes" to:
- Did I capture at least one concrete learning?
- Would a future agent benefit from what I wrote?
- Are the updates specific and actionable (not vague platitudes)?
