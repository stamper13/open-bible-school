import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";

/**
 * Non-destructive smoke coverage for public routes.
 *
 * Nothing here signs in, submits an answer, or writes to the database — these
 * run safely against any environment. Flows that need authenticated data are
 * covered by the manual checklist in docs/frontend-launch-runbook.md.
 */

/** React logs hydration mismatches as console errors, so watch for them. */
function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(String(err)));
  return errors;
}

const HYDRATION = /hydrat|did not match|server rendered html/i;

test.describe("public routes render", () => {
  for (const path of ["/", "/about", "/knowledge-map", "/bli"]) {
    test(`${path} opens without hydration errors`, async ({ page }) => {
      const errors = collectPageErrors(page);
      const response = await page.goto(path);

      expect(response?.status(), `${path} should return 200`).toBe(200);
      await expect(page.locator("body")).toBeVisible();

      const hydrationErrors = errors.filter(text => HYDRATION.test(text));
      expect(hydrationErrors, `hydration errors on ${path}`).toEqual([]);
    });
  }

  // A signed-out visitor with no completed assessment gets the "new learner"
  // landing, not the score dashboard: the "Your Learning Dashboard" header is
  // deliberately withheld until there is something to show (see
  // isNewAssessmentLanding in app/page.tsx). Assert the state this suite can
  // actually reach; the signed-in dashboard stays on the manual checklist.
  test("signed-out home shows the first-assessment landing", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Take your first Bible assessment/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Your Learning Dashboard/i })).toHaveCount(0);
  });

  // Likewise the knowledge map's hierarchy needs assessment data behind it, so
  // signed out the page renders its empty state and a way into an assessment.
  test("signed-out knowledge map shows its empty state and CTA", async ({ page }) => {
    await page.goto("/knowledge-map");
    await expect(
      page.getByText(/Nothing is filled in yet\. Answer questions to start coloring the Old Testament map\./i),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Get started/i })).toBeVisible();
  });
});

test.describe("assessment entry points", () => {
  test("selector exposes both Old and New Testament", async ({ page }) => {
    await page.goto("/assess?choose=1");
    await expect(page.getByRole("button", { name: /Old Testament Assessment/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /New Testament Assessment/i })).toBeVisible();
  });

  test("New Testament entry matches the current launch state", async ({ page }) => {
    await page.goto("/assess?choose=1");
    const ntButton = page.getByRole("button", { name: /New Testament Assessment/i });
    await expect(ntButton).toBeVisible();

    if (await ntButton.isEnabled()) {
      await ntButton.click();
      // The broad path carries scope=NT. An obsolete pilot chooser would send the
      // user back to ?choose=1 instead.
      await page.waitForURL(/testament=NT/);
      expect(page.url()).toContain("scope=NT");
      expect(page.url()).not.toContain("choose=1");
    } else {
      await expect(ntButton).toContainText(/Coming soon/i);
      await expect(ntButton).not.toContainText(/V7 router/i);
    }
  });
});

test.describe("signed-out state", () => {
  test("offers sign in and does not offer sign out", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign out$/i })).toHaveCount(0);
  });
});

test.describe("reduced motion", () => {
  // emulateMedia is used rather than the `reducedMotion` context option, which
  // did not take effect from a describe-level test.use() here.
  test("long transitions are suppressed on the dashboard", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // Gate on the landing heading a signed-out visitor actually gets, so this
    // waits for a rendered page rather than timing out on the dashboard header.
    await expect(page.getByRole("heading", { name: /Take your first Bible assessment/i })).toBeVisible();

    // Guard the emulation itself: if the media query does not match, the rest
    // of this test would pass or fail for the wrong reason.
    expect(
      await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
      "reduced-motion emulation not active",
    ).toBe(true);

    // Every animation should be effectively instant rather than a multi-second
    // reveal, and nothing should be left looping forever.
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll("body *"))) {
        const style = getComputedStyle(el);
        if (style.animationName === "none") continue;
        const seconds = parseFloat(style.animationDuration) || 0;
        const infinite = style.animationIterationCount === "infinite";
        if (seconds > 0.5 || infinite) {
          bad.push(`${el.className || el.tagName}:${style.animationName}:${style.animationDuration}:${style.animationIterationCount}`);
        }
      }
      return bad.slice(0, 10);
    });

    expect(offenders, "animations still running under reduced motion").toEqual([]);
  });

  test("assessment page honours reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/assess?choose=1");
    await expect(page.getByRole("button", { name: /Old Testament Assessment/i })).toBeVisible();

    const looping = await page.evaluate(() =>
      Array.from(document.querySelectorAll("body *"))
        .filter(el => getComputedStyle(el).animationIterationCount === "infinite")
        .length,
    );
    expect(looping, "infinite animations under reduced motion").toBe(0);
  });
});

test.describe("mobile layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ["/", "/about", "/knowledge-map", "/bli", "/assess?choose=1"]) {
    test(`${path} has no horizontal overflow at 390px`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      // One pixel of slack for sub-pixel rounding.
      expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(innerWidth + 1);
    });
  }

  test("primary dashboard controls meet a usable touch size", async ({ page }) => {
    await page.goto("/");
    const signIn = page.getByRole("button", { name: /^Sign in$/i });
    await expect(signIn).toBeVisible();
    const box = await signIn.boundingBox();
    expect(box!.height, "sign-in control height").toBeGreaterThanOrEqual(32);
  });

  test("home nav tucks page links into the mobile menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Take your first Bible assessment/i })).toBeVisible();

    await expect(page.locator(".nav-primary-link").first()).toBeHidden();
    await page.getByRole("button", { name: /Menu/i }).click();

    const menu = page.getByRole("menu", { name: /Site menu/i });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Assess/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Knowledge Map/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Reading Log/i })).toBeVisible();
  });
});
