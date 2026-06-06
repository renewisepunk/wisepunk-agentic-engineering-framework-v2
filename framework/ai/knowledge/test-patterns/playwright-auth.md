---
name: playwright-auth
applies_when: "Any Playwright acceptance/e2e spec (or agent walkthrough) that must run as a signed-in user — auth-gated routes, onboarding, dashboards, multi-tenant checks"
gates: [acceptance, user-value, security]
---

# Authenticating Playwright e2e (Clerk + other systems)

**Problem:** automated sign-in is blocked by the auth provider's **bot detection**, **new-device / MFA email codes**, and CAPTCHA — so a browser test can't just fill the login form. Every auth-gated spec hits this wall, and it fails *silently*: a "smoke" that never actually authenticates still shows green if its test step is non-blocking. (That's how a project can ship onboarding changes for weeks against a hollow check.)

**Principle:** don't fight the login UI. Use the provider's **test bypass** to get a *real* session past bot-detection/MFA, sign in **once** in global setup, and cache it with Playwright **`storageState`** so every spec starts authed — fast and reliable.

## Why Playwright, not agent-browser, for auth-gated e2e

agent-browser / Claude-in-Chrome can only **abort or mock** requests — they can't **rewrite** a request to append a test token, and have no init-script hook. Provider test-bypass tokens must be injected into the provider's API requests, which needs Playwright's `page.route` (rewrite + continue). So:

- **Auth-gated deterministic specs → Playwright** (it can inject the token + cache `storageState`).
- **Judgment walkthroughs** (user-value gate) can still use agent-browser/Claude-in-Chrome — but point them at an **already-authed** session by loading the saved `storageState`, rather than signing in through the UI.

## Clerk (worked example)

`@clerk/testing` mints a **Testing Token** from the secret key and injects `__clerk_testing_token` into Clerk's Frontend API requests, bypassing bot detection.

```bash
npm i -D @playwright/test @clerk/testing
npx playwright install --with-deps chromium
```

```js
// e2e/auth.mjs — sign in as a fresh user, return an authed page. Run with:
//   node --env-file=.env.local e2e/<spec>.mjs   (needs CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY)
import { chromium } from "playwright";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

export async function signInAsNewUser({ appUrl = "http://localhost:3000", ticket, orgName } = {}) {
  process.env.CLERK_PUBLISHABLE_KEY ||= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  await clerkSetup();                          // mints the Testing Token (secret key)
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await setupClerkTestingToken({ page });      // injects __clerk_testing_token → bypasses bot detection
  // GOTCHA 1: the ticket must be a top-level QUERY param, NOT the #/?__clerk_ticket hash
  //           that some seed scripts also print — the hash form never completes.
  await page.goto(`${appUrl}/sign-in?__clerk_ticket=${ticket}`, { waitUntil: "domcontentloaded" });
  // GOTCHA 2: if Clerk Organizations are enabled, a fresh user must complete an org-setup
  //           task before reaching the app.
  if (await page.getByText(/Setup your organization/i).count()) {
    await page.getByLabel("Name").first().fill(orgName ?? "E2E Co");
    await page.getByRole("button", { name: /^Continue$/ }).click();
  }
  return { browser, page };
}
```

Mint the user + `ticket` with the Clerk Backend SDK (`clerk.users.createUser` + `clerk.signInTokens.createSignInToken`). Then cache the session so specs don't re-login:

```ts
// playwright global-setup.ts: sign in once, save the authed state
await page.context().storageState({ path: "e2e/.auth/user.json" });
// playwright.config.ts:  use: { storageState: "e2e/.auth/user.json" }
```

### Clerk gotchas (each cost real debugging time)
- **Ticket format** — `/sign-in?__clerk_ticket=…` (query). The `#/?__clerk_ticket=…` hash form silently never signs in.
- **Org-setup task** — `CLERK_ORGS_ENABLED` adds a create-org step for fresh users; handle it before asserting on the app.
- **Without the Testing Token** the ticket bounces and password sign-in hits "new device" email verification (an emailed code automation can't read).

## Other auth systems — same shape, different bypass

The mechanism differs; the recipe is identical.

| System | Test bypass |
|---|---|
| **Clerk** | Testing Token (`@clerk/testing`) + sign-in ticket (query param) |
| **Auth0** | Resource-Owner-Password grant against a test tenant → set the session; or `storageState` |
| **NextAuth / custom** | A test-only credentials provider, or a `/api/test-login` route guarded to the test env that sets the session cookie |
| **Supabase** | `supabase.auth.signInWithPassword` (or admin `createSession`) in global setup |
| **Any provider** | Last resort: a test-env API login that returns the session, then `page.context().addCookies(...)` → `storageState` |

The constant: **(1)** use the provider's test path to get a real session past bot-detection/MFA, **(2)** sign in once in global setup, **(3)** cache with `storageState`, **(4)** every spec loads it.

## Recipe
1. Add `@playwright/test` + the provider's testing package; install chromium.
2. Global setup: sign in once via the bypass above → `storageState({ path })`.
3. `playwright.config.ts`: `use: { storageState }` so all specs start authed.
4. For multi-tenant / role specs, save one `storageState` per persona (`userA.json`, `userB.json`) and reuse — this is the auth half of the `cross-tenant-isolation-test` pattern.
5. Make the auth-gated smoke **blocking** once it reliably signs in — a non-blocking auth check is worse than none (it reads as green while testing nothing).

**Where this came from:** Paul9 PAU-318 — onboarding verification had been hollow for ~2 weeks (a non-blocking "smoke" that silently never authenticated). The fix was Clerk Testing Tokens + the query-param ticket + org-setup handling; the working harness immediately caught a real onboarding bug (PAU-319) the false-green check had hidden.
