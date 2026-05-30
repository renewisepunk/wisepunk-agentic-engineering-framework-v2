// Validation gate configuration.
//
// Each gate declares when it should run. The classifier (tools/gate-classifier.mjs)
// reads this file plus the current diff and writes ai/runs/<run>/gates.manifest.json
// telling /ship-feature which gates to run for this PR.
//
// Tune the globs to match your stack. The defaults below assume Next.js + Convex.
//
// Conventions:
//   - `always: true` runs the gate on every PR regardless of diff.
//   - `triggers` is an array of globs. Any matched file in the diff triggers the gate.
//   - `*` matches any non-slash chars; `**` matches any chars including slashes.
//   - `skipExtensions` filters out matching files before trigger evaluation
//     (e.g., test files and docs shouldn't trigger security on their own).
//   - `planOptOutAllowed` — if false, the gate cannot be skipped via plan declaration
//     (acceptance is always required; you can't argue your way out of it).

export default {
  gates: {
    acceptance: {
      description:
        "Executable acceptance tests derived from GWT criteria. Authored by Playwright Agent CLI during /new-feature and run by /ship-feature.",
      always: true,
      planOptOutAllowed: false,
    },

    "user-value": {
      description:
        "Implementing agent walks the golden path as the user persona declared in the plan. Subjective; LLM-in-the-loop is the point.",
      triggers: [
        "app/**/*.tsx",
        "app/**/*.ts",
        "components/**",
        "pages/**/*.tsx",
        "src/components/**",
      ],
      skipExtensions: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".md"],
      planOptOutAllowed: true,
    },

    security: {
      description:
        "Specialist reviewer pass focused on authn, authz, injection, PII, secret handling, and dependency vulnerabilities. Scaffolds no-auth/wrong-tenant tests for new HTTP routes.",
      triggers: [
        "app/api/**/route.ts",
        "app/api/**/route.tsx",
        "convex/http.ts",
        "convex/auth.ts",
        "lib/auth/**",
        "lib/actions/**",
        "middleware.ts",
        "package.json",
        "pnpm-lock.yaml",
      ],
      skipExtensions: [".test.ts", ".test.tsx", ".spec.ts", ".md"],
      planOptOutAllowed: true,
    },

    efficiency: {
      description:
        "Specialist reviewer pass focused on query plans, N+1, bundle size, hot-path latency, and stated efficiency budget compliance.",
      triggers: [
        "convex/**/*.ts",
        "lib/actions/**",
        "lib/db/**",
        "lib/queries/**",
        "next.config.*",
        "package.json",
        "app/**/page.tsx",
        "app/**/layout.tsx",
      ],
      skipExtensions: [".test.ts", ".test.tsx", ".spec.ts", ".md"],
      planOptOutAllowed: true,
    },

    eval: {
      description:
        "LLM-as-judge eval suite for quality-graded surfaces (search, ranking, AI agent outputs). Runs ai/eval-suites/<feature>.jsonl against preview backend.",
      triggers: [
        "lib/search/**",
        "lib/ranking/**",
        "lib/agents/**/system-prompt.ts",
        "lib/agents/**/tools.ts",
        "convex/agents/**",
        "convex/search/**",
      ],
      skipExtensions: [".test.ts", ".md"],
      planOptOutAllowed: true,
    },
  },
};
