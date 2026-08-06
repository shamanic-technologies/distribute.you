import { describe, expect, it, vi, afterEach } from "vitest";
import { getBrandSalesEconomics } from "../src/lib/api";

/**
 * brand-service RETIRED `optimizationGoal` from the sales-economics read
 * (brand-service#434, live in prod since 2026-08-02): the declared funnel set is
 * now the only vocabulary for what a brand sells through.
 *
 * This reader kept it REQUIRED, so `safeParse` threw on every call and every
 * consumer of `["brandSalesEconomics", brandId]` went dark — the Sales Funnels
 * card rendered blank rates, a blank lifetime revenue and `$0/day` on brands
 * whose numbers were sitting untouched on the wire. Reported as lost data.
 *
 * The sibling half of the same retirement (`goal` / `currentGoal` on the
 * declared-funnel payload) was fixed in #3273; this payload was the straggler.
 *
 * `apiCall` with an explicit token bypasses Clerk and the share-proxy branch, so
 * these are real parses of real payload shapes rather than source-substring
 * guards.
 */

const PROD_PAYLOAD = {
  salesEconomics: {
    lifetimeRevenueUsd: 2500,
    replyToMeetingPct: 31,
    visitToMeetingPct: 9.1,
    meetingToClosePct: 28.3,
    visitToSignupPct: 8.4,
    signupToPaidClientPct: 16.2,
    visitToClosePct: 1.3608,
    visitToPaidClientPct: 1.4,
    replyToPaidClientPct: 25,
    visitToFormSubmissionPct: 5,
    formSubmissionToPaidClientPct: 10,
    businessModel: null,
    funnelStages: [],
    updatedAt: "2026-07-31 14:57:15.867787+00",
  },
};

function stubFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
    clone() {
      return this;
    },
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getBrandSalesEconomics tolerates the retired goal", () => {
  it("parses the payload brand-service serves TODAY, which carries no optimizationGoal", async () => {
    stubFetch(PROD_PAYLOAD);

    const res = await getBrandSalesEconomics("b97440f6-5822-43de-ad1d-9886723536d6", "tok");

    // The numbers the customer stated survive the read. Before the fix this
    // threw, so the card had nothing to render.
    expect(res.salesEconomics?.lifetimeRevenueUsd).toBe(2500);
    expect(res.salesEconomics?.replyToMeetingPct).toBe(31);
    expect(res.salesEconomics?.meetingToClosePct).toBe(28.3);
    // Absent stays absent: a goal nobody sent is not defaulted to one here.
    expect(res.salesEconomics?.optimizationGoal).toBeUndefined();
  });

  it("still reads a legacy payload that carries the goal, normalising it", async () => {
    stubFetch({
      salesEconomics: { ...PROD_PAYLOAD.salesEconomics, optimizationGoal: "combined_sales" },
    });

    const res = await getBrandSalesEconomics("b97440f6-5822-43de-ad1d-9886723536d6", "tok");

    expect(res.salesEconomics?.optimizationGoal).toBe("sales");
  });

  it("keeps reading a brand that has stated nothing", async () => {
    stubFetch({ salesEconomics: null });

    const res = await getBrandSalesEconomics("b97440f6-5822-43de-ad1d-9886723536d6", "tok");

    expect(res.salesEconomics).toBeNull();
  });
});
