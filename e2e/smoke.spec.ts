import { expect, test } from "@playwright/test";

/**
 * The critical path a recruiter or interviewer walks in the first two minutes:
 * the dashboard is alive, the demo button catches fraud, an analyst can resolve
 * a case, and the model page shows real numbers. If this passes, the product's
 * whole story works end to end against the real model and database.
 */

test.beforeEach(async ({ request }) => {
  // Known thresholds so decisions are predictable regardless of prior tuning.
  await request.put("/api/settings", { data: { tLow: 0.01, tHigh: 0.99 } });
});

test("landing hero opens the live console", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /fraud, caught in milliseconds/i })).toBeVisible();
  await page.getByRole("button", { name: /open live console/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("overview shows KPIs and a live feed", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Transactions scored")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live authorizations" })).toBeVisible();
});

test("injecting a burst catches fraud in the feed", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Live authorizations" })).toBeVisible();
  await page.getByRole("button", { name: /inject fraud burst/i }).click();
  await expect(page.getByText(/transactions injected/i)).toBeVisible();

  // A burst guarantees fraud, and fraud at these thresholds is blocked. The feed
  // polls every 4s, so allow a few cycles for the blocked row to surface.
  const blockedInFeed = page.locator("tbody tr", { hasText: "Blocked" });
  await expect(blockedInFeed.first()).toBeVisible({ timeout: 20_000 });
});

test("an analyst can resolve a case from the queue", async ({ page, request }) => {
  // Widen the review band so the burst is guaranteed to open cases.
  await request.put("/api/settings", { data: { tLow: 0.0005, tHigh: 0.999999 } });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /inject fraud burst/i }).click();
  await expect(page.getByText(/transactions injected/i)).toBeVisible();

  await page.goto("/queue");
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 20_000 });
  const before = await page.locator("tbody tr").count();

  await firstRow.click();
  await expect(page.getByText("Why it was flagged")).toBeVisible();
  await page.getByRole("button", { name: /^Block$/ }).click();
  await expect(page.getByText(/transaction blocked/i)).toBeVisible();

  await expect(page.locator("tbody tr")).toHaveCount(before - 1);

  await request.put("/api/settings", { data: { tLow: 0.01, tHigh: 0.99 } });
});

test("model page shows real metrics and the tuner", async ({ page }) => {
  await page.goto("/model");
  await expect(page.getByRole("heading", { name: "Model", exact: true })).toBeVisible();
  await expect(page.getByText("PR-AUC").first()).toBeVisible();
  // The trained PR-AUC, not a placeholder. Scoped to its stat tile to avoid any
  // incidental match elsewhere on the page.
  await expect(page.getByText("0.802", { exact: true })).toBeVisible();
  await expect(page.locator("#t-high")).toBeVisible();
  await expect(page.getByRole("button", { name: /save thresholds/i })).toBeVisible();
});
