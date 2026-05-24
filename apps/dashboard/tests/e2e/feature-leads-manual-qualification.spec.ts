import { expect, test, type Page, type Route } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to run dashboard E2E tests.`);
  }
  return value;
}

const BRAND_ID = "00000000-0000-4000-8000-0000000000b1";
const CAMPAIGN_ID = "00000000-0000-4000-8000-0000000000c1";
const FEATURE_SLUG = "sales-cold-email-outreach@v1";
const LEAD_EMAIL = "alice@media.com";

const SALES_FEATURE = {
  slug: FEATURE_SLUG,
  name: "Sales Cold Email Outreach",
  description: "Lead generation + cold email outreach",
  status: "active",
  implemented: true,
  inputs: [],
  outputs: [],
  charts: [],
  entities: [],
};

const TEST_LEAD = {
  id: "00000000-0000-4000-8000-00000000l001",
  leadId: null,
  namespace: "test",
  email: LEAD_EMAIL,
  apolloPersonId: null,
  emailStatus: "verified",
  status: "served",
  statusReason: null,
  statusDetails: null,
  parentRunId: null,
  runId: null,
  brandIds: [BRAND_ID],
  campaignId: CAMPAIGN_ID,
  orgId: "org_test",
  userId: null,
  workflowSlug: null,
  featureSlug: FEATURE_SLUG,
  servedAt: new Date(Date.now() - 86_400_000).toISOString(),
  contacted: true,
  sent: true,
  delivered: true,
  opened: true,
  clicked: false,
  bounced: false,
  unsubscribed: false,
  replied: true,
  replyClassification: null,
  lastDeliveredAt: new Date(Date.now() - 86_400_000).toISOString(),
  global: { bounced: false, unsubscribed: false },
  lead: {
    firstName: "Alice",
    lastName: "Media",
    headline: "Journalist",
    linkedinUrl: null,
    organization: {
      name: "Media Co",
      primaryDomain: "media.com",
      industry: "Press",
      estimatedNumEmployees: 50,
    },
    contactMethods: [],
    employmentHistory: [],
  },
};

interface QualifBody {
  campaign_id: string;
  email: string;
  status: string;
  notes?: string;
}

interface QualifRow {
  id: string;
  orgId: string;
  campaignId: string;
  instantlyCampaignId: string;
  email: string;
  status: string;
  qualifiedBy: string;
  notes: string | null;
  qualifiedAt: string;
}

// Per-test in-memory store of qualifications. Replaces the upstream
// instantly-service bronze for the duration of the spec.
function makeQualificationStore() {
  const rows: QualifRow[] = [];
  let nextId = 1;
  return {
    rows,
    set(body: QualifBody): { idempotent: boolean; qualification: QualifRow } {
      const latest = rows.find(
        (r) => r.campaignId === body.campaign_id && r.email === body.email,
      );
      if (latest && latest.status === body.status) {
        return { idempotent: true, qualification: latest };
      }
      const row: QualifRow = {
        id: `q_${nextId++}`,
        orgId: "org_test",
        campaignId: body.campaign_id,
        instantlyCampaignId: `i_${body.campaign_id}`,
        email: body.email,
        status: body.status,
        qualifiedBy: "user_test",
        notes: body.notes ?? null,
        qualifiedAt: new Date().toISOString(),
      };
      rows.unshift(row);
      return { idempotent: false, qualification: row };
    },
  };
}

interface MockOpts {
  postOverride?: (req: { body: QualifBody }) => { status: number; json: unknown };
}

async function mockDashboardApi(page: Page, opts: MockOpts = {}) {
  const store = makeQualificationStore();
  const postCalls: QualifBody[] = [];

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = route.request().method();

    if (path === "/features") {
      return route.fulfill({ json: { features: [SALES_FEATURE] } });
    }
    if (path === `/features/${FEATURE_SLUG}`) {
      return route.fulfill({ json: { feature: SALES_FEATURE } });
    }
    if (path === "/features/stats/registry") {
      return route.fulfill({ json: { registry: {} } });
    }
    if (path === "/features/entities/registry") {
      return route.fulfill({ json: { registry: {} } });
    }
    if (path === "/leads") {
      return route.fulfill({ json: { leads: [TEST_LEAD] } });
    }
    if (path === "/workflows") {
      return route.fulfill({ json: { workflows: [] } });
    }
    if (path === "/brands/by-ids") {
      return route.fulfill({
        json: {
          brands: [
            {
              id: BRAND_ID,
              url: "https://media.com",
              name: "Media Co",
              domain: "media.com",
              logoUrl: null,
              createdAt: null,
              updatedAt: null,
            },
          ],
        },
      });
    }
    if (path === "/activity" || path === "/emails/send") {
      return route.fulfill({ json: { ok: true } });
    }
    if (path === "/billing/accounts") {
      return route.fulfill({
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
    }

    if (path === "/emails/manual-qualifications") {
      if (method === "GET") {
        return route.fulfill({ json: { qualifications: store.rows } });
      }
      if (method === "POST") {
        const body = JSON.parse(route.request().postData() ?? "{}") as QualifBody;
        postCalls.push(body);
        if (opts.postOverride) {
          const override = opts.postOverride({ body });
          return route.fulfill({ status: override.status, json: override.json });
        }
        return route.fulfill({ json: store.set(body) });
      }
    }

    return route.fulfill({ status: 404, json: { error: `Unmocked path: ${method} ${path}` } });
  });

  return { store, postCalls };
}

test.describe("Feature leads page — manual qualification modal", () => {
  test.beforeEach(async ({ page }) => {
    await setupClerkTestingToken({ page });
  });

  async function signInAndOpenLead(page: Page) {
    const emailAddress = requiredEnv("E2E_CLERK_USER_EMAIL");
    const orgId = requiredEnv("E2E_DASHBOARD_ORG_ID");
    await page.goto("/sign-in");
    await clerk.signIn({ page, emailAddress });
    await page.goto(`/orgs/${orgId}/brands/${BRAND_ID}/features/${FEATURE_SLUG}/leads`);
    // Open the right panel by clicking the lead row.
    await page.getByText(LEAD_EMAIL, { exact: false }).first().click().catch(() => {});
    // Some pages auto-pick a tab — fall back to clicking the row inside any visible tab.
    const row = page.locator(`tr:has-text("${TEST_LEAD.lead!.organization!.name}")`).first();
    await row.click();
  }

  test("opens modal with readout + 8 status options, commits a pick, badge appears, idempotent re-click is no-op", async ({ page }) => {
    const { postCalls } = await mockDashboardApi(page);
    await signInAndOpenLead(page);

    const openButton = page.getByTestId("open-edit-status-modal");
    await expect(openButton).toBeVisible();
    await openButton.click();

    const modal = page.getByTestId("edit-lead-status-modal");
    await expect(modal).toBeVisible();
    // Read-only audit rows
    await expect(modal.getByText("Consolidated")).toBeVisible();
    await expect(modal.getByText("Contacted")).toBeVisible();
    await expect(modal.getByText("Replied")).toBeVisible();
    // 8 editable options
    for (const status of [
      "lead_interested",
      "lead_meeting_booked",
      "lead_closed",
      "lead_not_interested",
      "lead_wrong_person",
      "lead_neutral",
      "lead_out_of_office",
      "auto_reply_received",
    ]) {
      await expect(modal.getByTestId(`status-option-${status}`)).toBeVisible();
    }

    // Commit "Interested"
    await modal.getByTestId("status-option-lead_interested").click();
    await expect(page.getByTestId("manual-qualification-badge")).toHaveAttribute(
      "data-status",
      "lead_interested",
    );
    await expect(page.getByTestId("manual-qualification-badge")).toHaveAttribute(
      "data-classification",
      "positive",
    );
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0]).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      email: LEAD_EMAIL,
      status: "lead_interested",
    });
    await expect(page.getByTestId("manual-qualification-error")).toHaveCount(0);

    // Re-click same status — POST round-trips, badge unchanged, no error
    await modal.getByTestId("status-option-lead_interested").click();
    await expect(page.getByTestId("manual-qualification-badge")).toHaveAttribute(
      "data-status",
      "lead_interested",
    );
    await expect(page.getByTestId("manual-qualification-error")).toHaveCount(0);
    expect(postCalls).toHaveLength(2);
  });

  test("POST 4xx surfaces inline error in modal, prior badge unchanged", async ({ page }) => {
    await mockDashboardApi(page, {
      postOverride: () => ({ status: 400, json: { error: "Bad status enum" } }),
    });
    await signInAndOpenLead(page);

    await page.getByTestId("open-edit-status-modal").click();
    const modal = page.getByTestId("edit-lead-status-modal");
    await expect(modal).toBeVisible();

    await modal.getByTestId("status-option-lead_not_interested").click();

    await expect(modal.getByTestId("manual-qualification-error")).toBeVisible();
    await expect(modal.getByTestId("manual-qualification-error")).toContainText("Bad status enum");
    await expect(page.getByTestId("manual-qualification-badge")).toHaveCount(0);
  });
});
