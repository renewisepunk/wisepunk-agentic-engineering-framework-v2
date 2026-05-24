# Workflow: Review

## Purpose

Assess the implementation against objective criteria. Produce actionable findings.

## Inputs

- The diff or branch to review
- The plan: `ai/runs/<run>/plan.md`
- `ai/STANDARDS.md`
- `ai/checklists/review.md`

## Steps

1. **Summarize what changed and why.** One paragraph. If you can't summarize it clearly, the change may be too large.

2. **Correctness review.**
   - Does the code do what the plan says?
   - Are all acceptance criteria met?
   - Are edge cases handled?
   - Are error paths covered, not just happy paths?

3. **Test review.**
   - Are there tests for new behavior?
   - Do tests cover failure paths?
   - Are tests deterministic and isolated?
   - Do the tests actually test the right thing (not just exercising code)?

4. **Security review.**
   - Are untrusted inputs validated?
   - Are authn/authz checks correct for new endpoints?
   - Are secrets/PII protected from logs and responses?

5. **Performance review.**
   - Any N+1 patterns or unbounded operations?
   - Are hot paths reasonable?
   - Are payloads bounded/paginated?

6. **Maintainability review.**
   - Is the code readable and consistent with the codebase?
   - Is complexity justified?
   - Are public API changes documented?

7. **Classify findings.** For each issue:
   - **Must fix** — blocks merge
   - **Should fix** — fix before next release
   - **Consider** — nice-to-have, not blocking

## Output

Create `ai/runs/<run>/review.md` with:
- Summary of changes
- Findings by category
- Required fixes (must-fix items)
- Open questions

## Stop conditions

Stop and escalate if:
- A critical security issue is found
- A major behavioral regression is likely
- The change set is too large to review reliably (suggest splitting)

## Checklist

Verify against `ai/checklists/review.md` before completing.
