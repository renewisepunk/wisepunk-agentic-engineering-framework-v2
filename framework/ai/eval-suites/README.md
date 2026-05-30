# Eval Suites

LLM-as-judge regression tests for **quality-graded** surfaces — search, ranking, AI agent outputs, summarization, anything where "correct" is a rubric, not a boolean.

This is the **eval** gate. Triggered when the diff touches files declared in `ai/gates.config.mjs` under `gates.eval.triggers` (default: `lib/search/**`, `lib/ranking/**`, `lib/agents/**/system-prompt.ts`, `convex/agents/**`).

Functional tests (Playwright acceptance specs) verify "the button works." Eval suites verify "the answer is good."

---

## When you need an eval suite vs. an acceptance test

| Use Playwright acceptance spec | Use an eval suite |
|---|---|
| "Form submits and creates a record" | "Search returns relevant results" |
| "Error state appears on bad input" | "Summary captures the key points" |
| "Endpoint returns 200 with the right shape" | "Agent picks the correct tool for the user's intent" |
| Outcome is binary | Outcome is graded |
| Re-running gives the same answer | Re-running gives a similar (not identical) answer |

If you find yourself writing assertions like "the output should contain the word 'because'" — you want an eval suite, not a Playwright test.

---

## File format

One JSONL file per feature surface, at `ai/eval-suites/<feature>.jsonl`. Each line is one test case:

```jsonl
{"id": "search-1", "input": {"q": "leads from Spain"}, "expected": {"min_results": 5, "must_mention": ["Spain"]}, "rubric": "Are the results actually leads from Spain (not generic European)?", "weight": 1.0}
{"id": "search-2", "input": {"q": "tech CTOs Berlin"}, "expected": {"min_results": 3, "must_mention": ["CTO", "Berlin"]}, "rubric": "Are CTOs in Berlin returned, not generic Berlin tech contacts?", "weight": 1.0}
```

### Required fields

- **`id`** — short, kebab-case, stable. Used in reports.
- **`input`** — JSON payload sent to the feature under test. Shape is feature-specific.
- **`rubric`** — one sentence in plain English describing what a passing answer looks like. The LLM judge reads this.

### Optional fields

- **`expected`** — structured assertions the runner can check before invoking the LLM judge (cheap pre-filter). E.g., `min_results`, `must_mention`, `must_not_contain`, `max_latency_ms`. Failures here count as a fail without an LLM call.
- **`weight`** — relative importance for the aggregate score (default 1.0)
- **`tags`** — for filtering (e.g., `["regression", "edge-case", "spain"]`)
- **`baseline`** — a previously-captured "good enough" output to compare against; only useful for diffing, not pass/fail
- **`skip_reason`** — non-empty value skips this case (use sparingly; prefer deletion)

### Example: AI tool-picking eval

```jsonl
{"id": "intent-1", "input": {"message": "schedule a demo for tomorrow"}, "expected": {"tool_called": "createSchedule"}, "rubric": "Did the agent pick the createSchedule tool with reasonable args?"}
{"id": "intent-2", "input": {"message": "show my leads from Q3"}, "expected": {"tool_called": "listLeads"}, "rubric": "Did the agent pick listLeads with a date filter for Q3?"}
{"id": "intent-3", "input": {"message": "what should I do today"}, "expected": {"tool_called": null}, "rubric": "Did the agent ask a clarifying question instead of guessing a tool?"}
```

---

## Running

```bash
# Default: run every suite, point at the preview backend declared in .env.local
node tools/eval-runner.mjs

# Specific suite
node tools/eval-runner.mjs --suite search

# Specific cases
node tools/eval-runner.mjs --suite search --filter spain

# Headless / CI mode (no interactive output, exits non-zero on regression)
node tools/eval-runner.mjs --ci
```

Output lands at `ai/runs/<run>/eval-report.md`.

---

## Authoring a new suite

1. **Seed from production traces.** Don't make up inputs — pull real (sanitized) queries from logs. The point of an eval suite is to lock in behavior on the inputs users actually send.
2. **Start with 10–20 cases per surface.** Enough to catch real regressions, few enough to author by hand. Grow over time.
3. **Mix difficulty.** Easy/medium/hard tier each case (`tags: ["easy"]` / `["hard"]`). Hard cases are the ones that catch model upgrades that quietly degrade quality.
4. **Update on every false-positive.** If the LLM judge says "fail" but the answer was actually fine, refine the rubric. Save the refined rubric — that's the compounding part.
5. **Write a test-pattern.** When you author a new eval suite for a new class of feature (e.g., "ranking evals"), document the recipe at `ai/knowledge/test-patterns/<class>-eval-pattern.md`.

---

## Anti-patterns

- **Don't put functional tests here.** "Endpoint returns 200" is a Playwright acceptance test, not an eval.
- **Don't write rubrics that are exact-match assertions in disguise.** Rubric: "the response should contain exactly the string 'Hello, Alice'" → use Playwright. Rubric: "the response addresses the user by name in a natural-sounding way" → eval.
- **Don't pin to a specific LLM output.** Outputs drift; rubrics should describe the *property* of a good answer, not the answer.
- **Don't run evals on every PR.** The `eval` gate runs only when triggers match (see `gates.config.mjs`). Otherwise you'll burn LLM credits on PRs that can't possibly affect quality.
