// Reusable Clerk sign-in for Playwright e2e — Clerk Testing Tokens bypass bot detection.
// Reference implementation; adapt for other providers (Auth0 / NextAuth / Supabase /
// custom) per ai/knowledge/test-patterns/playwright-auth.md.
//
// Self-contained: mints a fresh test user + a single-use sign-in ticket via the Clerk
// Backend SDK, then signs in past bot detection and returns an authed Playwright page.
//
//   npm i -D @playwright/test @clerk/testing @clerk/backend
//   npx playwright install --with-deps chromium
//   node --env-file=.env.local tools/e2e/clerk-auth.mjs   # smoke-check that auth works
//
// Needs (use TEST keys): CLERK_SECRET_KEY + (NEXT_PUBLIC_)CLERK_PUBLISHABLE_KEY, app running.
import { chromium } from "playwright";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClerkClient } from "@clerk/backend";

const PUBLISHABLE = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const SECRET = process.env.CLERK_SECRET_KEY;

/** Mint a fresh test user + a single-use sign-in ticket via the Clerk Backend SDK. */
export async function mintTestUser() {
  const clerk = createClerkClient({ secretKey: SECRET });
  // `+clerk_test` keeps the user test-flagged on dev instances.
  const email = `e2e-${Date.now()}+clerk_test@example.com`;
  const user = await clerk.users.createUser({
    emailAddress: [email],
    password: `E2E-pw-${Date.now()}!`,
    skipPasswordChecks: true,
  });
  const { token: ticket } = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 600,
  });
  return { email, userId: user.id, ticket };
}

/**
 * Sign in as a fresh user; returns { browser, page, email } with the page on the
 * post-login landing route. Caller owns browser.close(). Cache the session with
 * `await page.context().storageState({ path })` and reuse via playwright.config.ts.
 */
export async function signInAsNewUser({
  appUrl = process.env.APP_URL || "http://localhost:3000",
  headless = true,
  orgName = "E2E Co", // only used if Clerk Organizations are enabled
} = {}) {
  process.env.CLERK_PUBLISHABLE_KEY ||= PUBLISHABLE;
  await clerkSetup(); // mints the Testing Token from the secret key
  const { ticket, email } = await mintTestUser();

  const browser = await chromium.launch({ headless });
  const page = await (await browser.newContext()).newPage();
  await setupClerkTestingToken({ page }); // injects __clerk_testing_token → bypasses bot detection

  // GOTCHA: ticket must be a top-level QUERY param — the #/?__clerk_ticket hash never completes.
  await page.goto(`${appUrl}/sign-in?__clerk_ticket=${ticket}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // GOTCHA: Clerk Organizations → a fresh user must create an org before reaching the app.
  if (await page.getByText(/Setup your organization/i).count()) {
    await page.getByLabel("Name").first().fill(orgName);
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.waitForTimeout(4000);
  }
  return { browser, page, email };
}

// Run directly → sign in and report whether auth succeeded (a minimal smoke).
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!PUBLISHABLE || !SECRET) {
    console.error("Set CLERK_SECRET_KEY + (NEXT_PUBLIC_)CLERK_PUBLISHABLE_KEY (e.g. node --env-file=.env.local).");
    process.exit(1);
  }
  const { browser, page, email } = await signInAsNewUser({ headless: true });
  await page.waitForTimeout(4000);
  const url = page.url();
  console.log(`signed in as ${email} → ${url}`);
  const ok = !url.includes("/sign-in");
  console.log(ok ? "AUTH OK" : "AUTH FAILED (still on /sign-in)");
  await browser.close();
  process.exit(ok ? 0 : 1);
}
