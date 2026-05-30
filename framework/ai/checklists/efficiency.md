# Efficiency Review Checklist

Run by `/efficiency-review` when the efficiency gate triggers. Checks measurements against the **Efficiency budget** declared in `plan.md`.

A feature can pass functional review and still slip 200ms onto a hot path or 400KB onto the bundle. This gate exists because nobody notices that until prod.

---

## Budget compliance

- [ ] Plan declares an Efficiency budget (or explicitly states "n/a, this change has no perf impact" with reason)
- [ ] Worklog or review captures **before/after measurements** for each non-`n/a` budget dimension
- [ ] Every measured dimension is within the declared budget

If no budget was declared but the diff touches hot-path files (per `gates.config.mjs` triggers), that's a **Must fix** — the plan needs to be updated retroactively.

## Database queries

- [ ] No N+1 patterns: queries inside loops, `.map(async ...)` over DB calls, ORM accessors that lazy-load
- [ ] Every new query has an index for the filter columns (or uses an existing one)
- [ ] `EXPLAIN` plan reviewed for any new query against a table > 100k rows
- [ ] Joins bounded; no cartesian products in the new code path
- [ ] Pagination on every list endpoint (cursor or offset+limit); no unbounded `SELECT *`
- [ ] Transactions scoped to the smallest unit of work; long-held locks flagged

## Caching

- [ ] Caching used for any computation that doesn't depend on user input
- [ ] Cache keys include the relevant scope (user/tenant) — no cache poisoning across users
- [ ] TTL set deliberately, not "forever" by default
- [ ] Cache invalidation path exists for mutations that affect cached data

## Hot paths (request handlers, render functions)

- [ ] No synchronous I/O on the hot path (file reads, network calls outside the necessary fetch)
- [ ] No JSON parsing of large blobs in render
- [ ] No regex compilation inside hot loops
- [ ] Streaming where the response is large (don't buffer the whole body)
- [ ] LLM calls have explicit timeouts (no naked `await`)

## Frontend bundle

- [ ] No new heavy dep added to the client bundle without justification (check `package.json` diff)
- [ ] Dynamic imports used for code that isn't needed on initial render
- [ ] Server components stay server components — no accidental "use client" pulling a tree client-side
- [ ] Images use the framework's optimization (next/image or equivalent), not raw `<img>`
- [ ] If bundle size delta > 50KB: justified in the plan, or split out to a follow-up

## Background work

- [ ] Long-running operations dispatched to a queue/worker, not blocking a request
- [ ] Retries have backoff and a max-attempts cap (no infinite retry loops)
- [ ] Failed jobs land somewhere observable (DLQ, error log, alert)

## Memory

- [ ] No unbounded in-memory data structures (arrays/maps that grow per-request without cleanup)
- [ ] Large objects (>1MB) explicitly garbage-eligible at function exit
- [ ] No global mutable state introduced

## Measurement evidence

The implementer should attach evidence to `ai/runs/<run>/efficiency-evidence.md`:

```markdown
## Hot-path latency
- Endpoint: GET /api/leads
- Baseline (main): p50=42ms, p95=110ms (measured: ab -n 100 -c 10)
- This branch: p50=44ms, p95=118ms
- Budget: p95 < 150ms ✓

## DB queries per request
- Baseline: 3
- This branch: 4 (added schedule lookup; indexed)
- Budget: 5 ✓

## Bundle size delta
- Baseline: 412 KB gzipped
- This branch: 419 KB gzipped (+7 KB)
- Budget: +25 KB ✓
```

If the implementer didn't measure, that's a **Must fix**: re-run with measurements.

---

## Findings format

- **Must fix** — exceeds budget, or no measurement when measurement was required
- **Should fix** — within budget but concerning trend or smell
- **Consider** — optimization opportunity, not blocking

Cite `file:line` and include the measurement that triggered the finding.
