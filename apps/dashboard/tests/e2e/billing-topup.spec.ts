import { expect, test, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run dashboard billing E2E tests.`);
  }
  return value;
}

async function mockDashboardApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/features") {
      await route.fulfill({ json: { features: [] } });
      return;
    }

    if (path === "/features/stats/registry" || path === "/features/entities/registry") {
      await route.fulfill({ json: { registry: {} } });
      return;
    }

    if (path === "/billing/accounts") {
      // billing-service v3 splits credit into grants/runsSpent/available — all decimal strings.
      // Response keeps legacy reload* / hasAutoReload field names (billing-service has not
      // yet renamed its response shape; api-service only renamed request paths + bodies).
      await route.fulfill({
        json: {
          grantsCents: "2.0000000000",
          runsSpentCents: "0.0000000000",
          availableCents: "2.0000000000",
          currency: "usd",
          hasPaymentMethod: true,
          hasAutoReload: true,
          reloadAmountCents: "2500.0000000000",
          reloadThresholdCents: "500.0000000000",
        },
      });
      return;
    }

    if (path.startsWith("/runs")) {
      await route.fulfill({ json: { runs: [], offset: 0, limit: 10 } });
      return;
    }

    if (path === "/activity" || path === "/emails/send") {
      await route.fulfill({ json: { ok: true } });
      return;
    }

    await route.fulfill({
      status: 500,
      json: { error: `Unhandled E2E API route: ${path}` },
    });
  });
}

test.describe("Billing topup", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await mockDashboardApi(page);
  });

  test("opens the credit top-up modal from the billing header", async ({ page }) => {
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");

    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });

    await page.goto(`/orgs/${orgId}/billing`);

    await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
    const topupButton = page.getByRole("button", { name: "Top Up Credits" });
    await expect(topupButton).toBeVisible();

    await topupButton.click();

    await expect(page.getByRole("heading", { name: "Insufficient Credits" })).toBeVisible();
    await expect(page.getByText("Add Credits")).toBeVisible();
    await expect(page.getByLabel("Enable auto-topup")).toBeChecked();
    await expect(page.getByText("Top-up amount ($)")).toBeVisible();
  });
});
