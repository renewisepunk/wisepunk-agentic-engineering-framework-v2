# Workflow: Plan

## Purpose

Turn a request into a concrete, implementable plan with testable acceptance criteria.

## Inputs

Provide or derive these before starting:

- What is the problem or request?
- Who is affected?
- What constraints exist (security, performance, compatibility)?
- What parts of the codebase are involved?

## Steps

1. **Restate the problem.** Write it in plain language. If you can't state it clearly, the request needs clarification — stop and ask.

2. **Define scope.** List what's in scope and what's explicitly not. Non-goals are as important as goals.

3. **Surface unknowns.** List assumptions you're making and questions that need answers. Flag anything that could invalidate the plan.

4. **Propose a design.** Keep it minimal:
   - What changes to interfaces/APIs?
   - What changes to data models?
   - What are the key flows (happy path + error paths)?
   - What existing code is affected?

5. **Enumerate edge cases and failure modes.** For each, state how you'll handle it.

6. **Write acceptance criteria.** Each must be testable. Use the format: "Given [context], when [action], then [result]."

7. **Break into tasks.** Sequence them with checkpoints. Each task should be completable and reviewable independently.

8. **Write the test plan.** Specify what gets tested at each level (unit, integration, e2e). Include failure paths.

9. **Note rollout/rollback.** If the change affects production, state how to deploy and how to revert.

## Pre-mortem

Before finalizing, answer:
- What's most likely to go wrong?
- What edge case will we probably miss?
- If this fails in production, what does the blast radius look like?
- How do we detect failure?

## Output

Create `ai/runs/YYYY-MM-DD_short-name/plan.md` using the template in `ai/templates/plan.md`.

## Stop conditions

Stop and ask for human input if:
- Requirements are ambiguous after one attempt to clarify
- Multiple viable designs exist with meaningfully different tradeoffs
- The change is likely to break backwards compatibility
- The scope is larger than expected

## Checklist

Before marking the plan as done, verify against `ai/checklists/plan.md`.
