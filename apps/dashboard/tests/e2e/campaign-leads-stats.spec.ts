import { expect, test, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run dashboard E2E tests.`);
  }
  return value;
}

const CAMPAIGN_ID = "00000000-0000-4000-8000-000000000001";
const BRAND_ID = "00000000-0000-4000-8000-0000000000b1";
const FEATURE_SLUG = "sales-cold-email-outreach@v1";

const SALES_FEATURE = {
  slug: FEATURE_SLUG,
  name: "Sales Cold Email Outreach",
  description: "Lead generation + cold email outreach",
  status: "active",
  implemented: true,
  inputs: [],
  outputs: [],
  charts: [
    {
      type: "funnel-bar",
      steps: [
        { key: "leadsServed" },
        { key: "leadsContacted" },
        { key: "leadsDelivered" },
        { key: "leadsOpened" },
        { key: "leadsClicked" },
        { key: "leadsRepliesPositive" },
      ],
    },
    {
      type: "breakdown-bar",
      segments: [
        { key: "leadsRepliesPositive", color: "green", sentiment: "positive" },
        { key: "leadsRepliesNeutral", color: "gray", sentiment: "neutral" },
        { key: "leadsRepliesNegative", color: "red", sentiment: "negative" },
        { key: "leadsRepliesAutoReply", color: "blue", sentiment: "auto" },
      ],
    },
  ],
  entities: [],
};

const LEAD_KEYS = [
  "leadsServed",
  "leadsContacted",
  "leadsSent",
  "leadsDelivered",
  "leadsOpened",
  "leadsClicked",
  "leadsBounced",
  "leadsUnsubscribed",
  "leadsRepliesPositive",
  "leadsRepliesNegative",
  "leadsRepliesNeutral",
  "leadsRepliesAutoReply",
  "leadsRepliesInterested",
  "leadsRepliesMeetingBooked",
  "leadsRepliesClosed",
  "leadsRepliesNotInterested",
  "leadsRepliesWrongPerson",
  "leadsRepliesUnsubscribeDetail",
  "leadsRepliesNeutralDetail",
  "leadsRepliesAutoReplyDetail",
  "leadsRepliesOutOfOffice",
  "leadsBuffered",
  "leadsSkipped",
  "leadsClaimed",
];

const RATE_KEYS = [
  "leadOpenRate",
  "leadClickRate",
  "leadPositiveReplyRate",
  "leadNegativeReplyRate",
  "leadNeutralReplyRate",
];

const CURRENCY_KEYS = [
  "costPerLeadOpenCents",
  "costPerLeadClickCents",
  "costPerLeadPositiveReplyCents",
];

function buildRegistry(): Record<string, { type: "count" | "rate" | "currency"; label: string }> {
  const registry: Record<string, { type: "count" | "rate" | "currency"; label: string }> = {};
  const labels: Record<string, string> = {
    leadsServed: "Leads Served",
    leadsContacted: "Leads Contacted",
    leadsSent: "Leads Sent",
    leadsDelivered: "Leads Delivered",
    leadsOpened: "Leads Opened",
    leadsClicked: "Leads Clicked",
    leadsBounced: "Leads Bounced",
    leadsUnsubscribed: "Leads Unsubscribed",
    leadsRepliesPositive: "Positive Replies",
    leadsRepliesNegative: "Negative Replies",
    leadsRepliesNeutral: "Neutral Replies",
    leadsRepliesAutoReply: "Auto-Reply",
    leadsRepliesInterested: "Interested",
    leadsRepliesMeetingBooked: "Meeting Booked",
    leadsRepliesClosed: "Closed",
    leadsRepliesNotInterested: "Not Interested",
    leadsRepliesWrongPerson: "Wrong Person",
    leadsRepliesUnsubscribeDetail: "Unsubscribe (reply)",
    leadsRepliesNeutralDetail: "Neutral (detail)",
    leadsRepliesAutoReplyDetail: "Auto-Reply (detail)",
    leadsRepliesOutOfOffice: "Out of Office",
    leadsBuffered: "Leads Buffered",
    leadsSkipped: "Leads Skipped",
    leadsClaimed: "Leads Claimed",
  };
  for (const k of LEAD_KEYS) {
    registry[k] = { type: "count", label: labels[k] ?? k };
  }
  for (const k of RATE_KEYS) {
    registry[k] = { type: "rate", label: k };
  }
  for (const k of CURRENCY_KEYS) {
    registry[k] = { type: "currency", label: k };
  }
  return registry;
}

function buildStats(): Record<string, number> {
  return {
    leadsServed: 200,
    leadsContacted: 180,
    leadsSent: 175,
    leadsDelivered: 170,
    leadsOpened: 95,
    leadsClicked: 40,
    leadsBounced: 5,
    leadsUnsubscribed: 3,
    leadsRepliesPositive: 12,
    leadsRepliesNegative: 4,
    leadsRepliesNeutral: 6,
    leadsRepliesAutoReply: 2,
    leadsRepliesInterested: 8,
    leadsRepliesMeetingBooked: 3,
    leadsRepliesClosed: 1,
    leadsRepliesNotInterested: 2,
    leadsRepliesWrongPerson: 1,
    leadsRepliesUnsubscribeDetail: 1,
    leadsRepliesNeutralDetail: 5,
    leadsRepliesAutoReplyDetail: 2,
    leadsRepliesOutOfOffice: 1,
    leadsBuffered: 10,
    leadsSkipped: 5,
    leadsClaimed: 25,
    leadOpenRate: 0.559,
    leadClickRate: 0.235,
    leadPositiveReplyRate: 0.071,
    leadNegativeReplyRate: 0.024,
    leadNeutralReplyRate: 0.035,
    costPerLeadOpenCents: 12,
    costPerLeadClickCents: 28,
    costPerLeadPositiveReplyCents: 95,
  };
}

const FEATURE_STATS_RESPONSE = {
  featureSlug: FEATURE_SLUG,
  systemStats: {
    totalCostInUsdCents: 1140,
    completedRuns: 12,
    activeCampaigns: 1,
    firstRunAt: new Date(Date.now() - 86_400_000).toISOString(),
    lastRunAt: new Date().toISOString(),
  },
  stats: buildStats(),
};

const CAMPAIGN_STATS = {
  campaignId: CAMPAIGN_ID,
  totalCostInUsdCents: "1140",
  costBreakdown: [],
  leadsServed: 200,
  leadsBuffered: 10,
  leadsSkipped: 5,
  emailsGenerated: 175,
  recipientStats: {
    contacted: 180,
    sent: 175,
    delivered: 170,
    opened: 95,
    bounced: 5,
    clicked: 40,
    unsubscribed: 3,
    repliesPositive: 12,
    repliesNegative: 4,
    repliesNeutral: 6,
    repliesAutoReply: 2,
    repliesDetail: 24,
  },
  emailStats: {
    sent: 175,
    delivered: 170,
    opened: 95,
    clicked: 40,
    bounced: 5,
    unsubscribed: 3,
    stepStats: {},
  },
};

const CAMPAIGN = {
  id: CAMPAIGN_ID,
  organizationId: requiredEnvNoThrow("E2E_DASHBOARD_ORG_ID") ?? "org_test",
  name: "Test Sales Campaign",
  status: "ongoing",
  workflowSlug: "sales-cold-email-outreach@v1",
  featureSlug: FEATURE_SLUG,
  brandIds: [BRAND_ID],
  brandUrls: ["https://example.com"],
  featureInputs: null,
  maxBudgetDailyUsd: null,
  maxBudgetWeeklyUsd: null,
  maxBudgetMonthlyUsd: null,
  maxBudgetTotalUsd: null,
  endDate: null,
  toResumeAt: null,
  createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  updatedAt: new Date().toISOString(),
};

function requiredEnvNoThrow(name: string): string | null {
  return process.env[name] ?? null;
}

async function mockDashboardApi(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/features") {
      await route.fulfill({ json: { features: [SALES_FEATURE] } });
      return;
    }

    if (path === "/features/stats/registry") {
      await route.fulfill({ json: { registry: buildRegistry() } });
      return;
    }

    if (path === "/features/entities/registry") {
      await route.fulfill({ json: { registry: {} } });
      return;
    }

    if (path === `/features/${FEATURE_SLUG}/stats`) {
      await route.fulfill({ json: FEATURE_STATS_RESPONSE });
      return;
    }

    if (path === `/campaigns/${CAMPAIGN_ID}`) {
      await route.fulfill({ json: { campaign: CAMPAIGN } });
      return;
    }

    if (path === `/campaigns/${CAMPAIGN_ID}/stats`) {
      await route.fulfill({ json: CAMPAIGN_STATS });
      return;
    }

    if (path === "/leads") {
      await route.fulfill({ json: { leads: [] } });
      return;
    }

    if (path === `/campaigns/${CAMPAIGN_ID}/emails`) {
      await route.fulfill({ json: { emails: [] } });
      return;
    }

    if (path === "/billing/accounts") {
      await route.fulfill({
        json: {
          id: "00000000-0000-0000-0000-000000000001",
          org_id: "00000000-0000-0000-0000-00000000000a",
          balance_cents: "5000.0000000000",
          usage_cents: "0.0000000000",
          available_cents: "5000.0000000000",
          topup_amount_cents: null,
          topup_threshold_cents: null,
          has_payment_method: true,
          has_auto_topup: false,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-05-15T00:00:00.000Z",
        },
      });
      return;
    }

    if (path === "/activity" || path === "/emails/send") {
      await route.fulfill({ json: { ok: true } });
      return;
    }

    await route.fulfill({ status: 404, json: { error: `Unmocked path: ${path}` } });
  });
}

test.describe("Campaign leads tab — lead-scoped stats panel", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
    await mockDashboardApi(page);
  });

  test("renders aggregate lead stats panel with all sections", async ({ page }) => {
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");

    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });

    await page.goto(
      `/orgs/${orgId}/brands/${BRAND_ID}/features/${FEATURE_SLUG}/campaigns/${CAMPAIGN_ID}/leads`,
    );

    const panel = page.getByTestId("leads-stats-panel");
    await expect(panel).toBeVisible();

    await expect(panel.getByText("Pipeline", { exact: false })).toBeVisible();
    await expect(panel.getByText("Outreach", { exact: false })).toBeVisible();
    await expect(panel.getByText("Replies", { exact: false })).toBeVisible();
    await expect(panel.getByText("Cost", { exact: false })).toBeVisible();

    await expect(panel.getByText("Leads Claimed")).toBeVisible();
    await expect(panel.getByText("Leads Opened")).toBeVisible();
    await expect(panel.getByText("Positive Replies")).toBeVisible();
  });

  test("campaign overview funnel renders the new lead-scoped keys", async ({ page }) => {
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");

    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });

    await page.goto(
      `/orgs/${orgId}/brands/${BRAND_ID}/features/${FEATURE_SLUG}/campaigns/${CAMPAIGN_ID}`,
    );

    await expect(page.getByText("Campaign Funnel")).toBeVisible();
    await expect(page.getByText("Leads Served")).toBeVisible();
    await expect(page.getByText("Leads Contacted")).toBeVisible();
    await expect(page.getByText("Leads Delivered")).toBeVisible();
    await expect(page.getByText("Leads Opened")).toBeVisible();
    await expect(page.getByText("Leads Clicked")).toBeVisible();
    await expect(page.getByText("Positive Replies")).toBeVisible();
  });
});
