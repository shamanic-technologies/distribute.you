import { describe, expect, it } from "vitest";
import {
  collectOutcomeDigestSends,
  OUTCOME_DIGEST_BETA_FLAG,
  renderOutcomeDigestHtml,
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
    posthogHost: "https://eu.posthog.com",
    posthogProjectToken: "ph_project",
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
          date: null,
        },
      ],
      events: [],
    };
  }

  it("prepares one per-brand send for a beta user when the brand had an outcome that day", async () => {
    const day = previousUtcDay();
    const fetchMock: DigestFetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({
          data: [{ id: "org_beta", name: "Beta Org" }],
          total_count: 1,
        });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        expect(init?.headers).toMatchObject({ "x-external-org-id": "org_beta" });
        return jsonResponse({
          users: [
            {
              id: "internal-kevin",
              externalId: "user_kevin",
              email: "kevin@example.com",
              firstName: "Kevin",
              lastName: "Lourd",
              imageUrl: null,
              phone: null,
              createdAt: "2026-06-09T00:00:00.000Z",
            },
            {
              id: "internal-nonbeta",
              externalId: "user_nonbeta",
              email: "nonbeta@example.com",
              firstName: "No",
              lastName: "Beta",
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
      if (url.startsWith("https://eu.posthog.com/decide/?v=3")) {
        const body = JSON.parse(String(init?.body));
        return jsonResponse({
          featureFlags: {
            [OUTCOME_DIGEST_BETA_FLAG]: body.distinct_id === "user_kevin",
          },
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
    expect(result.betaUsers).toBe(1);
    expect(result.preparedSends).toHaveLength(1);
    expect(result.preparedSends[0]).toMatchObject({
      orgId: "org_beta",
      brandId: "brand_1",
      brandName: "Acme",
      userExternalId: "user_kevin",
      recipientEmail: "kevin@example.com",
      metadata: {
        brandName: "Acme",
        outcomeCount: "3",
        outcomeLabel: "positive replies",
        totalOutcomeOrganizations: "2",
        totalExpectedRevenueUsd: "$12,500",
      },
    });
    // Body lists the people (face + company logo) — name, photo, logo.dev domain.
    expect(result.preparedSends[0].metadata.digestHtml).toContain("Ada Lovelace");
    expect(result.preparedSends[0].metadata.digestHtml).toContain("https://img.example.test/ada.jpg");
    expect(result.preparedSends[0].metadata.digestHtml).toContain("img.logo.dev/leadco.test");
    expect(result.preparedSends[0].metadata.digestText).toContain("Ada Lovelace @ Lead Co");
  });

  it("does not prepare a send when a brand has pipeline but no outcome that day", async () => {
    const day = previousUtcDay();
    const fetchMock: DigestFetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({ data: [{ id: "org_beta", name: "Beta Org" }], total_count: 1 });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        return jsonResponse({
          users: [{
            id: "internal-kevin",
            externalId: "user_kevin",
            email: "kevin@example.com",
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
      if (url.startsWith("https://eu.posthog.com/decide/?v=3")) {
        return jsonResponse({ featureFlags: { [OUTCOME_DIGEST_BETA_FLAG]: true } });
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

    expect(result.betaUsers).toBe(1);
    expect(result.preparedSends).toHaveLength(0);
  });

  it("does not prepare sends for users outside the PostHog beta flag", async () => {
    const fetchMock: DigestFetch = async (input, init) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({ data: [{ id: "org_1", name: "Org" }], total_count: 1 });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        return jsonResponse({
          users: [{
            id: "internal-user",
            externalId: "user_no",
            email: "no@example.com",
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
      if (url.startsWith("https://eu.posthog.com/decide/?v=3")) {
        expect(JSON.parse(String(init?.body)).person_properties.email).toBe("no@example.com");
        return jsonResponse({ featureFlags: { [OUTCOME_DIGEST_BETA_FLAG]: false } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    expect(result.betaUsers).toBe(0);
    expect(result.preparedSends).toHaveLength(0);
  });

  it("does not prepare sends when beta users have no outcome organizations", async () => {
    const fetchMock: DigestFetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.clerk.com/v1/organizations")) {
        return jsonResponse({ data: [{ id: "org_1", name: "Org" }], total_count: 1 });
      }
      if (url === "https://api.example.test/v1/users?limit=100&offset=0") {
        return jsonResponse({
          users: [{
            id: "internal-user",
            externalId: "user_beta",
            email: "beta@example.com",
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
      if (url.startsWith("https://eu.posthog.com/decide/?v=3")) {
        return jsonResponse({ featureFlags: { [OUTCOME_DIGEST_BETA_FLAG]: true } });
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

    expect(result.betaUsers).toBe(1);
    expect(result.preparedSends).toHaveLength(0);
  });

  it("renders digest HTML with a people list — face photo + company logo", () => {
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
            expectedRevenueUsd: 8000,
          },
          {
            name: "Grace Hopper",
            photoUrl: null,
            companyName: "Navy Inc",
            companyLogoUrl: "https://cdn.example.test/navy.png",
            companyDomain: "navy.test",
            tags: ["clicked"],
            expectedRevenueUsd: 4500,
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
    expect(html).toContain("$8,000");
    expect(html).toContain("replied, clicked");
  });
});
