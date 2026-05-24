# Workflow: Work

## Purpose

Implement the plan. Produce code, tests, and a worklog.

## Inputs

- The plan: `ai/runs/<run>/plan.md`
- `ai/STANDARDS.md`
- `ai/knowledge/pitfalls/` (check before starting — one file per pitfall)

## Steps

1. **Read the plan.** Re-read the acceptance criteria and task breakdown. Do not start coding before you understand what "done" looks like.

2. **Check pitfalls.** List `ai/knowledge/pitfalls/` and read any files whose filename hints at relevance to your work. Avoid repeating known mistakes.

3. **Implement in small increments.** Each increment should be:
   - Focused on one task from the plan
   - Buildable and testable on its own
   - Committed separately with a clear message

4. **Write tests alongside code.** Do not defer tests. Each task's tests should pass before moving to the next task.

5. **Keep a worklog.** As you implement, note:
   - Decisions made that weren't in the plan
   - Surprises or deviations from the plan
   - Things that were harder or easier than expected
   - Shortcuts taken and their justification

6. **Validate against acceptance criteria.** Before marking work as complete, verify every acceptance criterion from the plan is met.

## Output

- Code changes (committed)
- Tests (passing)
- `ai/runs/<run>/worklog.md` with implementation notes

## Stop conditions

Stop and ask for human input if:
- You discover the plan is wrong or incomplete
- A task is significantly harder than estimated
- You need to make a design decision not covered by the plan
- Tests reveal a flaw in the approach
