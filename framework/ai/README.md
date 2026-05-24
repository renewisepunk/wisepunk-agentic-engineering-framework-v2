# ai/ — Agentic Engineering Workspace

This folder is the AI-readable substrate of your project. Every agent reads from it and writes to it. Humans read from it too; nothing here is generated, all of it is authored.

## Layout

```
ai/
  CONTEXT.md              what this project is, who uses it, stack, environments
  STANDARDS.md            engineering rules enforced by review
  workflows/              the four-step loop
    plan.md
    work.md
    review.md
    compound.md
  templates/
    plan.md               the template /new-feature fills in
  checklists/             pre-merge gates
    plan.md
    review.md
    ai-first.md           Three-Surface enforcement
  knowledge/              accumulated learnings (compounds over time)
    pitfalls/             one file per failure mode
    patterns/             one file per reusable approach
    decisions/            ADRs for significant architectural decisions
  runs/                   per-feature audit trails
    YYYY-MM-DD_ISSUE_slug/
      plan.md
      worklog.md
      review.md
      compound.md
  test-suites/            (optional) UI smoke scenarios — one per file
```

## Read order for a new agent

1. `CONTEXT.md` — what this project is and how it's deployed
2. `STANDARDS.md` — rules to follow
3. `knowledge/pitfalls/` — known failure modes (list + skim relevant ones)
4. `knowledge/patterns/` — known good approaches
5. (skill-specific) The specific workflow file for the step you're on

The `/new-feature` skill encapsulates this reading order. Use it.

## What goes in here vs. the rest of the repo

| Lives in `ai/` | Lives elsewhere |
|---|---|
| Standards, conventions, rules | The code those rules apply to |
| Plans for what will be built | The code that gets built |
| Lessons learned (pitfalls, patterns) | The tests that catch regressions |
| Action manifest (what the system can do) | The implementations of those actions |

Rule of thumb: anything an *agent* needs to read to do its job correctly lives here. Anything an *agent* writes (code, tests) lives in the normal repo structure.
