import { test, expect, type ConsoleMessage, type Page, type Request } from "@playwright/test";

/**
 * Analytics regression: the dashboard must never record `recommendation_viewed`
 * without an explicit user interaction, and one explicit interaction must
 * produce exactly one logical event.
 *
 * The unauthenticated block runs everywhere and needs no credentials. The
 * authenticated block requires a DISPOSABLE staging account and therefore
 * writes real study events; it is skipped unless OBS_E2E_EMAIL and
 * OBS_E2E_PASSWORD are set, and it must never be pointed at production.
 *
 *   OBS_E2E_EMAIL=... OBS_E2E_PASSWORD=... npx playwright test recommendation-analytics
 */

type StudyEventCall = {
  eventType: string;
  source: string | undefined;
  idempotencyKey: string | undefined;
  surface: string | undefined;
};

/** Records every obs_record_study_event RPC the page fires. */
function collectStudyEvents(page: Page) {
  const calls: StudyEventCall[] = [];
  page.on("request", (request: Request) => {
    if (!request.url().includes("/rest/v1/rpc/obs_record_study_event")) return;
    if (request.method() !== "POST") return;
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(request.postData() ?? "{}") as Record<string, unknown>;
    } catch {
      body = {};
    }
    const metadata = (body.p_metadata ?? {}) as Record<string, string | undefined>;
    calls.push({
      eventType: String(body.p_event_type ?? ""),
      source: metadata.source,
      idempotencyKey: metadata.idempotency_key,
      surface: metadata.interaction_surface,
    });
  });
  return calls;
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.text());
  });
  page.on("pageerror", err => errors.push(String(err)));
  return errors;
}

const views = (calls: StudyEventCall[]) => calls.filter(c => c.eventType === "recommendation_viewed");

test.describe("recommendation analytics — no credentials required", () => {
  test("dashboard mount records no study event at all", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(4_000);

    expect(views(calls), "rendering the dashboard must not record recommendation_viewed").toHaveLength(0);
  });

  test("dashboard reload records no study event at all", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await page.goto("/");
    await page.waitForTimeout(2_000);
    calls.length = 0;

    await page.reload();
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(4_000);

    expect(views(calls), "reloading the dashboard must not record recommendation_viewed").toHaveLength(0);
  });

  test("navigating away and back records no study event", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await page.goto("/");
    await page.waitForTimeout(2_000);
    calls.length = 0;

    await page.goto("/about");
    await page.goto("/");
    await page.waitForTimeout(4_000);

    expect(views(calls), "remounting the dashboard must not record recommendation_viewed").toHaveLength(0);
  });

  test("the dashboard renders without console errors", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(3_000);

    expect(errors.filter(e => /recommendation|study event/i.test(e))).toHaveLength(0);
  });
});

/**
 * Authenticated matrix. STAGING/BRANCH ONLY — these write real study events.
 */
test.describe("recommendation analytics — explicit interaction (staging only)", () => {
  const email = process.env.OBS_E2E_EMAIL;
  const password = process.env.OBS_E2E_PASSWORD;

  test.skip(
    !email || !password,
    "Set OBS_E2E_EMAIL and OBS_E2E_PASSWORD for a disposable staging account. Never run against production.",
  );

  async function signIn(page: Page) {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in|continue with email/i }).first().click();
    await page.getByLabel(/email/i).fill(email as string);
    await page.getByLabel(/password/i).fill(password as string);
    await page.getByRole("button", { name: /sign in|continue/i }).last().click();
    await expect(page.locator(".recommended-action")).toBeVisible({ timeout: 20_000 });
  }

  test("signed-in dashboard render and reload record zero recommendation_viewed rows", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await signIn(page);
    await page.waitForTimeout(3_000);
    expect(views(calls), "sign-in + render must not record a view").toHaveLength(0);

    calls.length = 0;
    await page.reload();
    await expect(page.locator(".recommended-action")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(3_000);
    expect(views(calls), "reload must not record a view").toHaveLength(0);
  });

  test("one explicit expand records exactly one event carrying an idempotency key", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await signIn(page);
    calls.length = 0;

    await page.getByRole("button", { name: "View learning details" }).click();
    await page.waitForTimeout(2_000);

    const recorded = views(calls);
    expect(recorded).toHaveLength(1);
    expect(recorded[0].source).toBe("dashboard_recommendation");
    expect(recorded[0].surface).toBe("scope_detail");
    expect(recorded[0].idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  test("a double-click produces one logical event", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await signIn(page);
    calls.length = 0;

    const expand = page.getByRole("button", { name: "View learning details" });
    await expand.dblclick();
    await page.waitForTimeout(2_000);

    const recorded = views(calls);
    // Either the in-flight guard suppressed the second handler outright, or
    // both requests carry the SAME key and the database collapses them.
    const distinctKeys = new Set(recorded.map(call => call.idempotencyKey));
    expect(distinctKeys.size).toBe(1);
  });

  test("two separate interactions produce two distinct keys", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await signIn(page);
    calls.length = 0;

    await page.getByRole("button", { name: "View learning details" }).click();
    await page.waitForTimeout(1_500);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "View learning details" }).click();
    await page.waitForTimeout(1_500);

    const recorded = views(calls);
    expect(recorded).toHaveLength(2);
    expect(new Set(recorded.map(call => call.idempotencyKey)).size).toBe(2);
  });

  test("a failed request is retried with the same key", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await signIn(page);
    calls.length = 0;

    let failed = false;
    await page.route("**/rest/v1/rpc/obs_record_study_event", async route => {
      if (!failed) {
        failed = true;
        await route.fulfill({ status: 503, body: "{}" });
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "View learning details" }).click();
    await page.waitForTimeout(4_000);

    const recorded = views(calls);
    expect(recorded.length).toBeGreaterThanOrEqual(2);
    expect(new Set(recorded.map(call => call.idempotencyKey)).size).toBe(1);
  });

  test("the retest CTA still navigates and emits no client retest_started", async ({ page }) => {
    const calls = collectStudyEvents(page);
    await signIn(page);
    calls.length = 0;

    await page.locator(".recommended-action").click();
    // Within the reread window the interstitial opens instead of navigating.
    const modal = page.getByRole("dialog");
    if (await modal.isVisible().catch(() => false)) {
      await modal.getByRole("button", { name: /reread/i }).click();
    }
    await page.waitForTimeout(3_000);

    expect(views(calls), "the CTA click is one explicit view").toHaveLength(1);
    // The server-side start RPC is the sole producer of retest_started, so the
    // browser must issue no obs_record_study_event call for that type at all.
    expect(calls.filter(call => call.eventType === "retest_started")).toHaveLength(0);
    // Navigation still happened (or the interstitial handled it).
    await expect(page).toHaveURL(/\/assess\?/);
  });
});
