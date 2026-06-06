# tools/e2e — authenticated browser e2e

Reusable harness for running Playwright e2e **as a signed-in user**, past the auth provider's bot detection / MFA. Skill: `/e2e-auth`. Recipe: `ai/knowledge/test-patterns/playwright-auth.md`.

## Why
Automated sign-in is blocked by bot detection + new-device/MFA codes + CAPTCHA — and it fails *silently* (a non-blocking smoke goes green while authenticating nothing). Use the provider's **test bypass** → sign in once → cache with `storageState` → every spec starts authed.

## Clerk (this folder)
`clerk-auth.mjs` is the reference implementation (Testing Token + sign-in ticket + org-setup). Self-contained — it mints the test user via the Clerk Backend SDK.

```bash
npm i -D @playwright/test @clerk/testing @clerk/backend
npx playwright install --with-deps chromium
# verify auth works (app must be running), using TEST keys:
node --env-file=.env.local tools/e2e/clerk-auth.mjs        # → AUTH OK
```

Cache the session in a Playwright global setup:

```ts
// e2e/global-setup.ts
import { signInAsNewUser } from "../tools/e2e/clerk-auth.mjs";
export default async function () {
  const { browser, page } = await signInAsNewUser({ headless: true });
  await page.context().storageState({ path: "e2e/.auth/user.json" });
  await browser.close();
}
// playwright.config.ts:  globalSetup: "./e2e/global-setup.ts",  use: { storageState: "e2e/.auth/user.json" }
```

Specs then start authed:

```ts
test("dashboard loads for a signed-in user", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
});
```

## Other providers
Same shape, different bypass — see the test-pattern's table (Auth0 password-grant on a test tenant, NextAuth/custom `/api/test-login`, Supabase `signInWithPassword`, or a generic test-env API login → `context.addCookies(...)` → `storageState`). Drop a sibling `<provider>-auth.mjs` exposing the same `signInAsNewUser()` contract so specs are provider-agnostic.

## Gotchas
- Clerk ticket must be a **query param** (`?__clerk_ticket=`), not the `#/?` hash.
- Clerk Organizations → handle the org-setup step before asserting on the app.
- Use **test keys** (`pk_test_*` / `sk_test_*`); production Testing Tokens don't support code-based methods.
- **agent-browser can't inject the token** (no request rewrite / init-script) → auth-gated specs use Playwright; judgment walkthroughs load the saved `storageState`.
