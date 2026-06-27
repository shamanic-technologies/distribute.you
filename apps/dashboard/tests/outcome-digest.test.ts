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

  it("prepares sends only for PostHog beta users in orgs with sales outcomes", async () => {
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
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1") {
        return jsonResponse({
          featureSlug: "sales-cold-email-outreach",
          headline: { totalPipelineUsd: 12500 },
          costEconomics: {
            actualCostUsd: 250,
            costOfAcquisitionPct: 2,
            roiMultiple: 50,
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
              tags: ["opened"],
              expectedRevenueUsd: 4500,
              mostAdvancedDate: null,
            },
          ],
          leads: [],
          events: [],
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    expect(result.scannedOrgs).toBe(1);
    expect(result.betaUsers).toBe(1);
    expect(result.preparedSends).toHaveLength(1);
    expect(result.preparedSends[0]).toMatchObject({
      orgId: "org_beta",
      userExternalId: "user_kevin",
      recipientEmail: "kevin@example.com",
      metadata: {
        orgName: "Beta Org",
        totalBrandsWithOutcomes: "1",
        totalOutcomeOrganizations: "2",
        totalExpectedRevenueUsd: "$12,500",
      },
    });
    expect(result.preparedSends[0].metadata.digestHtml).toContain("Lead Co");
    expect(result.preparedSends[0].metadata.digestText).toContain("Acme");
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

  it("renders digest HTML with brand sections and expected revenue", () => {
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
      },
    ]);

    expect(html).toContain("Acme");
    expect(html).toContain("Lead Co");
    expect(html).toContain("$8,000");
    expect(html).toContain("replied, clicked");
  });
});
