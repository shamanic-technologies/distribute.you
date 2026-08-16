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

  // An outcome timestamp landing on the closed day. Start-of-yesterday is 24-48h
  // before ANY same-day test run → formatTimeAgo deterministically yields "1d ago".
  function outcomeAtOnDay(day: string): string {
    return `${day}T00:00:01.000Z`;
  }

  const ORGS = [
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
  ];

  // A pipeline lead; `outcome` overrides the per-goal signal fields (clickedAt /
  // repliedPositiveAt / signup(+At) / formSubmission(+At) / purchased(+At)). Lead 0
  // is richly enriched (drives the firmographic assertions).
  function lead(i: number, outcome: Record<string, unknown>): Record<string, unknown> {
    const rich = i === 0;
    return {
      leadId: `lead-${i + 1}`,
      firstName: rich ? "Ada" : `Person${i}`,
      lastName: rich ? "Lovelace" : "Reply",
      photoUrl: rich ? "https://img.example.test/ada.jpg" : null,
      orgName: rich ? "Lead Co" : "Pipeline Inc",
      orgLogoUrl: null,
      orgDomain: rich ? "leadco.test" : "pipeline.test",
      tags: ["replied"],
      expectedRevenueUsd: rich ? 8000 : 4000,
      conversionProbabilityPct: null,
      contacted: true,
      contactedAt: null,
      clickedAt: null,
      repliedPositiveAt: null,
      title: rich ? "Head of Growth" : null,
      seniority: rich ? "director" : null,
      orgIndustry: rich ? "Marketing" : null,
      orgEmployeeCount: rich ? 120 : null,
      orgCity: rich ? "Austin" : null,
      orgCountry: rich ? "United States" : null,
      date: null,
      ...outcome,
    };
  }

  // Brand revenue with 2 pipeline orgs + `count` leads carrying a positive-reply
  // outcome ON `day` (the default positive_replies / sales_meetings goal path).
  function revenueWithLeads(leads: unknown[], day = previousUtcDay()): unknown {
    return {
      featureSlug: "sales-cold-email-outreach",
      headline: { totalPipelineUsd: 12500 },
      costEconomics: { actualCostUsd: 250, costOfAcquisitionPct: 2, roiMultiple: 50 },
      // The digest only fires when the return went UP on the day, so every fixture
      // that expects a send carries an improving curve. Both figures are served —
      // the email prints these two points and computes nothing.
      roiHistory: improvingRoi(day),
      timeSeries: [],
      organizations: ORGS,
      leads,
      events: [],
    };
  }

  /** A two-point cumulative curve that RISES on `day` — the send condition. */
  function improvingRoi(day: string) {
    return {
      daily: [
        { date: dayBefore(day), cumulativeSpendUsd: 200, cumulativePipelineUsd: 8000, roiMultiple: 40 },
        { date: day, cumulativeSpendUsd: 250, cumulativePipelineUsd: 12500, roiMultiple: 50 },
      ],
      datedPipelineUsd: 12500,
      undatedPipelineUsd: 0,
    };
  }

  /** The same curve FLAT on `day` — the return did not move, so nothing is news. */
  function flatRoi(day: string) {
    return {
      daily: [
        { date: dayBefore(day), cumulativeSpendUsd: 200, cumulativePipelineUsd: 8000, roiMultiple: 50 },
        { date: day, cumulativeSpendUsd: 250, cumulativePipelineUsd: 12500, roiMultiple: 50 },
      ],
      datedPipelineUsd: 12500,
      undatedPipelineUsd: 0,
    };
  }

  function dayBefore(day: string): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  }

  function brandRevenue(repliedCountOnDay: number, day: string): unknown {
    const at = outcomeAtOnDay(day);
    return revenueWithLeads(
      Array.from({ length: repliedCountOnDay }, (_, i) =>
        lead(i, { repliedPositiveAt: at }),
      ),
    );
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
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1&pricing=net") {
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
        roiToday: "50.0×",
        roiPrevious: "40.0×",
        newOutcomes: "3 positive replies",
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
    expect(send.metadata.digestHtml).toContain("1d ago");
    // Green per-person outcome pill names the goal outcome (singular noun).
    expect(send.metadata.digestHtml).toContain("positive reply");
    expect(send.metadata.digestText).toContain("Ada Lovelace");
    expect(send.metadata.digestText).toContain("1d ago");
    // Firmographics for reassurance — title, industry, banded headcount, location.
    expect(send.metadata.digestHtml).toContain("Head of Growth");
    expect(send.metadata.digestHtml).toContain("Marketing");
    expect(send.metadata.digestHtml).toContain("51-200 employees");
    expect(send.metadata.digestHtml).toContain("Austin, United States");
    expect(send.metadata.digestText).toContain("Head of Growth");
    expect(send.metadata.digestText).toContain("51-200 employees");
  });

  it("sends to the customer only — no staff blind copy", async () => {
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
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1&pricing=net") {
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
    // Postmark bills per recipient and the account is on the free plan (100 a
    // month, hard stop). The staff blind copy that used to ride every customer
    // digest doubled the cost of the largest recurring email we send, for a
    // monitoring need Postmark's own 45-day Activity archive already covers.
    expect(sendBodies[0].bccEmails).toBeUndefined();
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
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1&pricing=net") {
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
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_empty&pricing=net") {
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

  it("isolates a failing brand — one brand's fetch error does not skip the rest", async () => {
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
          brands: [
            { id: "brand_bad", domain: "bad.test", name: "Bad", brandUrl: "https://bad.test", createdAt: null, updatedAt: null, logoUrl: null },
            { id: "brand_good", domain: "good.test", name: "Good", brandUrl: "https://good.test", createdAt: null, updatedAt: null, logoUrl: null },
          ],
        });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_bad&pricing=net") {
        // brand_bad's revenue keeps timing out — must NOT abort the whole run.
        throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_good&pricing=net") {
        return jsonResponse(brandRevenue(3, day));
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    // brand_bad is skipped after its retries exhaust; brand_good still sends.
    expect(result.scannedOrgs).toBe(1);
    expect(result.preparedSends).toHaveLength(1);
    expect(result.preparedSends[0].brandId).toBe("brand_good");
  });

  it("retries a transient fetch timeout and recovers", async () => {
    const day = previousUtcDay();
    let revenueAttempts = 0;
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
          brands: [{ id: "brand_1", domain: "acme.test", name: "Acme", brandUrl: "https://acme.test", createdAt: null, updatedAt: null, logoUrl: null }],
        });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1&pricing=net") {
        revenueAttempts += 1;
        if (revenueAttempts === 1) {
          throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
        }
        return jsonResponse(brandRevenue(3, day));
      }
      throw new Error(`Unexpected fetch ${url}`);
    };

    const result = await collectOutcomeDigestSends({ ...env, fetchFn: fetchMock });

    expect(revenueAttempts).toBe(2); // first timed out, second (retry) succeeded
    expect(result.preparedSends).toHaveLength(1);
    expect(result.preparedSends[0].brandId).toBe("brand_1");
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
            outcomeNoun: "website visit",
            title: "Head of Growth",
            orgIndustry: "Marketing",
            orgEmployeeCount: 120,
            location: "Austin, United States",
          },
          {
            name: "Grace Hopper",
            photoUrl: null,
            companyName: "Navy Inc",
            companyLogoUrl: "https://cdn.example.test/navy.png",
            companyDomain: "navy.test",
            tags: ["clicked"],
            outcomeNoun: null,
            outcomeAt: null,
            // All firmographics unknown → the row omits them (no synthesis).
            title: null,
            orgIndustry: null,
            orgEmployeeCount: null,
            location: null,
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
    // Green outcome pill shows for the person WITH an outcome, once (Grace has none).
    expect(html).toContain("website visit");
    expect(html.match(/website visit/g)).toHaveLength(1);
    // Firmographics render for the enriched person, banded headcount + location.
    expect(html).toContain("Head of Growth");
    expect(html).toContain("Marketing");
    expect(html).toContain("51-200 employees");
    expect(html).toContain("Austin, United States");
  });

  // A single org / user / brand fetch stub parameterized by the /revenue payload.
  // There is no goal fetch any more: what the digest names is whatever landed.
  function digestFetch(revenue: unknown): DigestFetch {
    return async (input) => {
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
          brands: [{ id: "brand_1", domain: "acme.test", name: "Acme", brandUrl: "https://acme.test", createdAt: null, updatedAt: null, logoUrl: null }],
        });
      }
      if (url === "https://api.example.test/v1/features/sales-cold-email-outreach/revenue?brandId=brand_1&pricing=net") {
        return jsonResponse(revenue);
      }
      throw new Error(`Unexpected fetch ${url}`);
    };
  }

  it("names the outcome that actually landed, whatever kind it is", async () => {
    const at = outcomeAtOnDay(previousUtcDay());
    const revenue = revenueWithLeads([
      lead(0, { formSubmission: true, formSubmissionAt: at, clickedAt: at }),
      lead(1, { formSubmission: true, formSubmissionAt: at, clickedAt: at }),
    ]);
    const result = await collectOutcomeDigestSends({ ...env, fetchFn: digestFetch(revenue) });
    expect(result.preparedSends).toHaveLength(1);
    expect(result.preparedSends[0].metadata).toMatchObject({
      newOutcomes: "2 form submissions",
    });
    // A lead that both clicked and submitted is reported as the MORE ADVANCED of
    // the two — reporting the visit would understate what happened.
    expect(result.preparedSends[0].metadata.digestHtml).toContain("form submission");
  });

  it("names SEVERAL kinds when a brand's funnels each landed something", async () => {
    // The whole reason the goal had to go: a brand runs several funnels at once, so
    // a day can carry a reply on one and a signup on another. One goal could name
    // only one of them.
    const at = outcomeAtOnDay(previousUtcDay());
    const revenue = revenueWithLeads([
      lead(0, { signup: true, signupAt: at, clickedAt: at }),
      lead(1, { repliedPositiveAt: at }),
      lead(2, { repliedPositiveAt: at }),
    ]);
    const result = await collectOutcomeDigestSends({ ...env, fetchFn: digestFetch(revenue) });
    expect(result.preparedSends).toHaveLength(1);
    // Most advanced first, and the counts add up to the people the email lists.
    expect(result.preparedSends[0].metadata).toMatchObject({
      newOutcomes: "1 signup and 2 positive replies",
    });
  });

  it("sends NOTHING when the return did not improve, however much landed", async () => {
    // The gate is the point of the email. A day that produced outcomes but moved the
    // return nowhere is not news, and an inbox that gets it anyway learns to ignore
    // the one that is.
    const at = outcomeAtOnDay(previousUtcDay());
    const revenue = revenueWithLeads([
      lead(0, { repliedPositiveAt: at }),
      lead(1, { repliedPositiveAt: at }),
    ]) as Record<string, unknown>;
    revenue.roiHistory = flatRoi(previousUtcDay());
    const result = await collectOutcomeDigestSends({ ...env, fetchFn: digestFetch(revenue) });
    expect(result.preparedSends).toHaveLength(0);
  });

  it("sends nothing when the return cannot be measured at all", async () => {
    // features-service is fail-soft on the curve, so an absent one means "we could
    // not measure this" — never "it improved".
    const at = outcomeAtOnDay(previousUtcDay());
    const revenue = revenueWithLeads([lead(0, { repliedPositiveAt: at })]) as Record<string, unknown>;
    revenue.roiHistory = null;
    const result = await collectOutcomeDigestSends({ ...env, fetchFn: digestFetch(revenue) });
    expect(result.preparedSends).toHaveLength(0);
  });

  it("sends nothing when the return rose but nothing new landed", async () => {
    const revenue = revenueWithLeads([lead(0, {})]);
    const result = await collectOutcomeDigestSends({ ...env, fetchFn: digestFetch(revenue) });
    expect(result.preparedSends).toHaveLength(0);
  });
});
