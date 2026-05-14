import { expect, test, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run dashboard visibility-runs E2E tests.`);
  }
  return value;
}

const FIXTURE_BRAND_ID = "11111111-1111-1111-1111-111111111111";
const FIXTURE_FEATURE_SLUG = "ai-visibility-scoring-v1";
const FIXTURE_CAMPAIGN_ID = "22222222-2222-2222-2222-222222222222";
const FIXTURE_RUN_ID = "33333333-3333-3333-3333-333333333333";

const ENTITY_REGISTRY_FIXTURE = {
  registry: {
    "visibility-runs": {
      label: "Visibility runs",
      icon: "sparkles",
      pathSuffix: "visibility-runs",
      description: "Time-series brand visibility audit",
    },
    prompts: {
      label: "Prompts",
      icon: "message-square",
      pathSuffix: "prompts",
      description: "Prompts tested in the latest run",
    },
    competitors: {
      label: "Competitors",
      icon: "swords",
      pathSuffix: "competitors",
      description: "Competing brands surfaced in the latest run",
    },
  },
};

const FEATURES_FIXTURE = {
  features: [
    {
      id: "feat-visibility",
      slug: FIXTURE_FEATURE_SLUG,
      name: "AI Visibility Scoring",
      description: "Time-series brand visibility audit across LLMs.",
      status: "active",
      implemented: true,
      inputs: [],
      outputs: [],
      charts: [],
      entities: [
        { name: "visibility-runs" },
        { name: "prompts" },
        { name: "competitors" },
      ],
      byokProvider: null,
    },
  ],
};

const CAMPAIGN_FIXTURE = {
  campaign: {
    id: FIXTURE_CAMPAIGN_ID,
    name: "Test campaign",
    status: "ongoing",
    featureSlug: FIXTURE_FEATURE_SLUG,
    workflowSlug: null,
    brandUrls: [],
    createdAt: new Date().toISOString(),
  },
};

const VISIBILITY_RUNS_FIXTURE = {
  runs: [
    {
      id: FIXTURE_RUN_ID,
      orgId: "org-1",
      brandId: FIXTURE_BRAND_ID,
      parentRunId: null,
      runId: null,
      domain: "example.com",
      brandName: "Example",
      llmProvider: "openai",
      llmModel: "gpt-4o",
      promptGenModel: "gpt-4o",
      extractionProvider: "openai",
      extractionModel: "gpt-4o",
      nPrompts: 25,
      weights: {
        brandMentionRate: 0.2,
        citationRate: 0.2,
        positionScore: 0.2,
        shareOfVoice: 0.2,
        sentiment: 0.1,
        brandAndUrlRate: 0.1,
      },
      visibilityScore: "0.42",
      brandMentionRate: "0.55",
      shareOfVoice: "0.30",
      netSentiment: "0.15",
      citationRate: "0.20",
      avgPosition: "2.5",
      status: "completed",
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      visibility_score_delta: "0.05",
      share_of_voice_delta: "-0.02",
      net_sentiment_delta: null,
      position_delta: "-0.5",
    },
  ],
  limit: 50,
  offset: 0,
};

async function mockApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/features") {
      await route.fulfill({ json: FEATURES_FIXTURE });
      return;
    }
    if (path === `/features/${FIXTURE_FEATURE_SLUG}`) {
      await route.fulfill({ json: { feature: FEATURES_FIXTURE.features[0] } });
      return;
    }
    if (path === "/features/entities/registry") {
      await route.fulfill({ json: ENTITY_REGISTRY_FIXTURE });
      return;
    }
    if (path === "/features/stats/registry") {
      await route.fulfill({ json: { registry: {} } });
      return;
    }
    if (path === `/campaigns/${FIXTURE_CAMPAIGN_ID}`) {
      await route.fulfill({ json: CAMPAIGN_FIXTURE });
      return;
    }
    if (path.startsWith("/orgs/visibility-score-runs")) {
      await route.fulfill({ json: VISIBILITY_RUNS_FIXTURE });
      return;
    }
    if (path === "/billing/accounts") {
      await route.fulfill({
        json: {
          grantsCents: "100.00",
          runsSpentCents: "0.00",
          availableCents: "100.00",
          currency: "usd",
          hasPaymentMethod: true,
          hasAutoReload: false,
          reloadAmountCents: "0",
          reloadThresholdCents: "0",
        },
      });
      return;
    }
    if (path === "/keys") {
      await route.fulfill({ json: { keys: [] } });
      return;
    }
    // catch-all
    await route.fulfill({ json: {} });
  });
}

test.describe("Visibility runs page", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await mockApi(page);
  });

  test("renders empty state when no runs exist", async ({ page }) => {
    await page.route("**/api/v1/visibility-score-runs**", async (route) => {
      await route.fulfill({ json: { runs: [], limit: 50, offset: 0 } });
    });
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");

    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });

    await page.goto(
      `/orgs/${orgId}/brands/${FIXTURE_BRAND_ID}/features/${FIXTURE_FEATURE_SLUG}/campaigns/${FIXTURE_CAMPAIGN_ID}/visibility-runs`,
    );

    await expect(page.getByRole("heading", { name: "Visibility runs" })).toBeVisible();
    await expect(page.getByTestId("visibility-runs-empty")).toBeVisible();
  });

  test("renders score cards + chart + table when runs exist", async ({ page }) => {
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");

    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });

    await page.goto(
      `/orgs/${orgId}/brands/${FIXTURE_BRAND_ID}/features/${FIXTURE_FEATURE_SLUG}/campaigns/${FIXTURE_CAMPAIGN_ID}/visibility-runs`,
    );

    await expect(page.getByRole("heading", { name: "Visibility runs" })).toBeVisible();
    await expect(page.getByTestId("visibility-latest-scores")).toBeVisible();
    await expect(page.getByText("42.0%")).toBeVisible();
    await expect(page.getByTestId("visibility-chart")).toBeVisible();
    await expect(page.getByTestId("visibility-runs-table")).toBeVisible();
  });
});
