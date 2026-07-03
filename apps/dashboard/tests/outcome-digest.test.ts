import { describe, expect, it } from "vitest";
import { ADMIN_ALLOWED_EMAILS } from "../src/lib/admin-allowlist";
import {
  collectOutcomeDigestSends,
  renderOutcomeDigestHtml,
  sendOutcomeDigestEmails,
  type DigestFetch,
} from "../src/lib/outcome-digest";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("daily outcome digest", () => {
  const env = {
    apiUrl: "https://api.example.test",
    adminApiKey: "adminkey",
    clerkSecretKey: "clerkkey",
  };

  // The digest reports on the UTC calendar day that just closed.
  function previousUtcDay(): string {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
    )
      .toISOString()
      .slice(0, 10);
  }

  // A recent positive-reply timestamp → drives the "time ago" row (sales_meetings goal).
  const repliedThreeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  // Brand revenue fixture: 2 pipeline orgs + a positive-reply series whose count
  // for `day` is controllable (drives the sales_meetings outcome gate).
  function brandRevenue(repliedCountOnDay: number, day: string): unknown {
    return {
      featureSlug: "sales-cold-email-outreach",
      headline: { totalPipelineUsd: 12500 },
      costEconomics: { actualCostUsd: 250, costOfAcquisitionPct: 2, roiMultiple: 50 },
      repliedPositive: {
        total: repliedCountOnDay,
        daily: repliedCountOnDay > 0 ? [{ date: day, count: repliedCountOnDay }] : [],
        undatedCount: 0,
      },
      timeSeries: [],
      organizations: [
        {
          orgId: "lead-org-1",
          orgName: "Lead Co",
          orgLogoUrl: null,
          orgDomain: "leadco.test",
          topPerson: { firstName: "Ada", lastName: "Lovelace", photoUrl: null },
          tags: ["replied", "clicked"],
          expectedRevenueUsd: 8000,
          mostAdvancedDate: null,
        },
        {
          orgId: "lead-org-2",
          orgName: "Pipeline Inc",
          orgLogoUrl: null,
          orgDomain: "pipeline.test",
          topPerson: null,
          tags: ["delivered"],
          expectedRevenueUsd: 4500,
          mostAdvancedDate: null,
        },
      ],
      leads: [
        {
          leadId: "lead-1",
          firstName: "Ada",
          lastName: "Lovelace",
          photoUrl: "https://img.example.test/ada.jpg",
          orgName: "Lead Co",
          orgLogoUrl: null,
          orgDomain: "leadco.test",
          tags: ["replied"],
          expectedRevenueUsd: 8000,
          conversionProbabilityPct: null,
          contacted: true,
          contactedAt: null,
          clickedAt: null,
          repliedPositiveAt: repliedThreeHoursAgo,
          date: null,
        },
      ],
      events: [],
    };
  }

  it("prepares a per-brand send for EVERY customer user (no beta gate)", async () => {
    const day = previousUtcDay();
    const fetchMock: DigestFetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({
          data: [{ id: "org_1", name: "Customer Org" }],
          total_count: 1,
        });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        expect(init?.headers).toMatchObject({ "x-external-org-id": "org_1" });
        return jsonResponse({
          users: [
            {
              id: "internal-owner",
              externalId: "user_owner",
              email: "owner@customer.com",
              firstName: "Casey",
              lastName: "Owner",
              imageUrl: null,
              phone: null,
              createdAt: "2026-06-09T00:00:00.000Z",
            },
            {
              id: "internal-mate",
              externalId: "user_mate",
              email: "teammate@customer.com",
              firstName: "Sam",
              lastName: "Mate",
              imageUrl: null,
              phone: null,
              createdAt: "2026-06-09T00:00:00.000Z",
            },
          ],
          total: 2,
          limit: 100,
          offset: 0,
        });
      }
      if (url === "https://api.example.test/v1/brands") {
        return jsonResponse({
          brands: [
            {
              id: "brand_1",
              domain: "acme.test",
              name: "Acme",
              brandUrl: "https://acme.test",
              createdAt: null,
              updatedAt: null,
              logoUrl: null,
            },
          ],
        });
      }
      if (url === "https://api.example.test/v1/brands/brand_1/sales-economics") {
        return jsonResponse({ salesEconomics: { optimizationGoal: "sales_meetings" } });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1") {
        return jsonResponse(brandRevenue(3, day));
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    expect(result.scannedOrgs).toBe(1);
    // No beta gate — both org users are eligible recipients.
    expect(result.eligibleUsers).toBe(2);
    expect(result.preparedSends).toHaveLength(2);
    expect(result.preparedSends.map((s) => s.recipientEmail).sort()).toEqual([
      "owner@customer.com",
      "teammate@customer.com",
    ]);
    const send = result.preparedSends[0];
    expect(send).toMatchObject({
      orgId: "org_1",
      brandId: "brand_1",
      brandName: "Acme",
      metadata: {
        brandName: "Acme",
        outcomeCount: "3",
        outcomeLabel: "positive replies",
        totalOutcomeOrganizations: "2",
      },
    });
    // Revenue is no longer mentioned anywhere in the digest.
    expect(send.metadata.totalExpectedRevenueUsd).toBeUndefined();
    expect(send.metadata.digestHtml).not.toContain("expected revenue");
    expect(send.metadata.digestHtml).not.toContain("$");
    // Body lists the people (face + company logo) + a discreet time-ago (not a $ amount).
    expect(send.metadata.digestHtml).toContain("Ada Lovelace");
    expect(send.metadata.digestHtml).toContain("https://img.example.test/ada.jpg");
    expect(send.metadata.digestHtml).toContain("img.logo.dev/leadco.test");
    expect(send.metadata.digestHtml).toContain("3h ago");
    expect(send.metadata.digestText).toContain("Ada Lovelace @ Lead Co");
    expect(send.metadata.digestText).toContain("3h ago");
  });

  it("blind-copies the staff allowlist (minus a staff recipient) on each send", async () => {
    const day = previousUtcDay();
    const sendBodies: Array<Record<string, unknown>> = [];
    // Recipient is a staff member → they must be excluded from their own BCC.
    const staffRecipient = ADMIN_ALLOWED_EMAILS[0];
    const fetchMock: DigestFetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({ data: [{ id: "org_1", name: "Org" }], total_count: 1 });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        return jsonResponse({
          users: [{
            id: "internal-staff",
            externalId: "user_staff",
            email: staffRecipient,
            firstName: "Kevin",
            lastName: "Lourd",
            imageUrl: null,
            phone: null,
            createdAt: "2026-06-09T00:00:00.000Z",
          }],
          total: 1,
          limit: 100,
          offset: 0,
        });
      }
      if (url === "https://api.example.test/v1/brands") {
        return jsonResponse({
          brands: [{
            id: "brand_1",
            domain: "acme.test",
            name: "Acme",
            brandUrl: "https://acme.test",
            createdAt: null,
            updatedAt: null,
            logoUrl: null,
          }],
        });
      }
      if (url === "https://api.example.test/v1/brands/brand_1/sales-economics") {
        return jsonResponse({ salesEconomics: { optimizationGoal: "sales_meetings" } });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1") {
        return jsonResponse(brandRevenue(3, day));
      }
      if (url === "https://api.example.test/v1/emails/send") {
        sendBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ sent: true });
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await sendOutcomeDigestEmails({ ...env, fetchFn: fetchMock });

    expect(result.sent).toBe(1);
    expect(sendBodies).toHaveLength(1);
    expect(sendBodies[0].recipientEmail).toBe(staffRecipient);
    // Staff blind-copied, recipient (a staff member) filtered out of their own BCC.
    expect(sendBodies[0].bccEmails).toEqual(
      ADMIN_ALLOWED_EMAILS.filter((e) => e !== staffRecipient),
    );
    expect(sendBodies[0].bccEmails).not.toContain(staffRecipient);
  });

  it("does not prepare a send when a brand has pipeline but no outcome that day", async () => {
    const day = previousUtcDay();
    const fetchMock: DigestFetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({ data: [{ id: "org_1", name: "Org" }], total_count: 1 });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        return jsonResponse({
          users: [{
            id: "internal-user",
            externalId: "user_1",
            email: "owner@customer.com",
            firstName: "Casey",
            lastName: "Owner",
            imageUrl: null,
            phone: null,
            createdAt: "2026-06-09T00:00:00.000Z",
          }],
          total: 1,
          limit: 100,
          offset: 0,
        });
      }
      if (url === "https://api.example.test/v1/brands") {
        return jsonResponse({
          brands: [{
            id: "brand_1",
            domain: "acme.test",
            name: "Acme",
            brandUrl: "https://acme.test",
            createdAt: null,
            updatedAt: null,
            logoUrl: null,
          }],
        });
      }
      if (url === "https://api.example.test/v1/brands/brand_1/sales-economics") {
        return jsonResponse({ salesEconomics: { optimizationGoal: "sales_meetings" } });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1") {
        // Pipeline present, but zero positive replies on the reported day.
        return jsonResponse(brandRevenue(0, day));
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    expect(result.eligibleUsers).toBe(1);
    expect(result.preparedSends).toHaveLength(0);
  });

  it("does not prepare sends when a brand has no outcome organizations", async () => {
    const fetchMock: DigestFetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({ data: [{ id: "org_1", name: "Org" }], total_count: 1 });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        return jsonResponse({
          users: [{
            id: "internal-user",
            externalId: "user_1",
            email: "owner@customer.com",
            firstName: null,
            lastName: null,
            imageUrl: null,
            phone: null,
            createdAt: "2026-06-09T00:00:00.000Z",
          }],
          total: 1,
          limit: 100,
          offset: 0,
        });
      }
      if (url === "https://api.example.test/v1/brands") {
        return jsonResponse({
          brands: [{
            id: "brand_empty",
            domain: "empty.test",
            name: "Empty",
            brandUrl: "https://empty.test",
            createdAt: null,
            updatedAt: null,
            logoUrl: null,
          }],
        });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_empty") {
        return jsonResponse({
          featureSlug: "sales-cold-email-outreach",
          headline: { totalPipelineUsd: 0 },
          costEconomics: {
            actualCostUsd: 0,
            costOfAcquisitionPct: null,
            roiMultiple: null,
          },
          timeSeries: [],
          organizations: [],
          leads: [],
          events: [],
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    expect(result.eligibleUsers).toBe(1);
    expect(result.preparedSends).toHaveLength(0);
  });

  it("renders digest HTML with a people list + discreet time-ago, no revenue", () => {
    const clickedTwoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const html = renderOutcomeDigestHtml([
      {
        brandName: "Acme",
        brandUrl: "https://acme.test",
        totalPipelineUsd: 12500,
        organizations: [
          {
            orgName: "Lead Co",
            expectedRevenueUsd: 8000,
            tags: ["replied", "clicked"],
            topPersonName: "Ada Lovelace",
          },
        ],
        leads: [
          {
            name: "Ada Lovelace",
            photoUrl: "https://img.example.test/ada.jpg",
            companyName: "Lead Co",
            companyLogoUrl: null,
            companyDomain: "leadco.test",
            tags: ["replied", "clicked"],
            outcomeAt: clickedTwoDaysAgo,
          },
          {
            name: "Grace Hopper",
            photoUrl: null,
            companyName: "Navy Inc",
            companyLogoUrl: "https://cdn.example.test/navy.png",
            companyDomain: "navy.test",
            tags: ["clicked"],
            outcomeAt: null,
          },
        ],
      },
    ]);

    expect(html).toContain("Acme");
    // Person with a photo → <img>; person without → initials circle.
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("https://img.example.test/ada.jpg");
    expect(html).toContain("Grace Hopper");
    expect(html).toContain(">G</span>"); // initials fallback for the null-photo person
    // Company logo: backend logo wins; else logo.dev from the domain.
    expect(html).toContain("https://cdn.example.test/navy.png");
    expect(html).toContain("img.logo.dev/leadco.test");
    // Discreet time-ago replaces the old $ amount; a null outcomeAt renders nothing.
    expect(html).toContain("2d ago");
    expect(html).not.toContain("$");
    expect(html).not.toContain("expected revenue");
    expect(html).toContain("replied, clicked");
  });
});
