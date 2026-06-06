---
name: e2e-auth
description: This skill should be used when an agent or user needs to run or author an AUTHENTICATED browser test or walkthrough — "test this as a logged-in user", "run the e2e / smoke", "verify the dashboard", "the smoke can't log in", "sign in for tests", "set up Playwright auth", "test the authed flow". Covers getting past the auth provider's bot-detection / MFA (Clerk Testing Tokens; Auth0 / NextAuth / Supabase / custom equivalents), caching the session with storageState, and why auth-gated specs use Playwright, not agent-browser.
---

# Authenticated browser e2e

Run a real browser as a signed-in user — for the **acceptance** gate (deterministic Playwright specs) or a one-off verification. The assertions are never the hard part; **getting authenticated without a human** is. This skill is how.

> Knowledge recipe: `ai/knowledge/test-patterns/playwright-auth.md`. Reference helper: `tools/e2e/clerk-auth.mjs`.

## The wall (read first)
You cannot drive the login form in automation: the provider's **bot detection**, **new-device / MFA email codes**, and CAPTCHA block it. And it fails *silently* — a smoke whose test step is non-blocking still goes green while authenticating nothing. **A non-blocking auth check is worse than none** (a project can ship auth-gated changes for weeks against a hollow check).

The fix always has the same shape:
1. Use the provider's **test bypass** to get a *real* session past bot-detection/MFA.
2. Sign in **once** in global setup.
3. Cache the session with Playwright **`storageState`**.
4. Every spec (and any agent-browser walkthrough) loads it — no UI login.

## Playwright, not agent-browser, for auth-gated specs
agent-browser / Claude-in-Chrome can only **abort or mock** requests — they can't **rewrite** a request to append the provider's test token, and have no init-script hook. Token injection needs Playwright's `page.route`. So:
- **Auth-gated deterministic specs → Playwright.**
- **Judgment walkthroughs (user-value gate)** → Claude-in-Chrome is fine, but load the saved `storageState` instead of logging in through the UI.

## Per-provider bypass
| Provider | Bypass |
|---|---|
| **Clerk** | `@clerk/testing` Testing Token + a sign-in **ticket** (query param). Use `tools/e2e/clerk-auth.mjs`. |
| **Auth0** | Resource-Owner-Password grant on a **test tenant** → set session / storageState. |
| **NextAuth / custom** | A test-env-guarded `/api/test-login` route that sets the session cookie. |
| **Supabase** | `supabase.auth.signInWithPassword` (or admin `createSession`) in global setup. |
| **Any** | Last resort: a test-env API login → `context.addCookies(...)` → storageState. |

## Steps
1. Install: `npm i -D @playwright/test @clerk/testing @clerk/backend` (swap the provider pkgs); `npx playwright install --with-deps chromium`.
2. Auth setup: copy `tools/e2e/clerk-auth.mjs` (Clerk) or adapt per the table. It mints a fresh user + signs in past bot detection and returns an authed `page`.
3. Global setup: sign in once → `await page.context().storageState({ path: "e2e/.auth/user.json" })`.
4. `playwright.config.ts`: `use: { storageState: "e2e/.auth/user.json" }`.
5. Author/run specs — they start authed. For multi-tenant/role tests, save one `storageState` per persona (`userA.json`, `userB.json`) — the auth half of `cross-tenant-isolation-test`.
6. **Make the smoke blocking** once it reliably signs in (drop `continue-on-error`).

## Clerk gotchas (each cost real time to find)
- The sign-in ticket must be a **query param** (`/sign-in?__clerk_ticket=`), NOT the `#/?__clerk_ticket=` hash some seed scripts print — the hash never completes.
- If Clerk **Organizations** are enabled, a fresh user must complete an org-setup step before reaching the app.
- Use **test keys** (`pk_test_*` / `sk_test_*`); production Testing Tokens don't support code-based methods.

## Verify it works (one-off)
```bash
node --env-file=.env.local tools/e2e/clerk-auth.mjs   # signs in, prints the landed URL + AUTH OK/FAILED
```
Then drive assertions/screenshots from the returned page — see `tools/e2e/README.md`.

**Where this came from:** Paul9 PAU-318/319 — onboarding e2e had been hollow for weeks (a non-blocking smoke that never authenticated). Testing Tokens fixed it and immediately caught a real onboarding bug the false-green check had hidden.
