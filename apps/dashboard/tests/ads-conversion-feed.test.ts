import { describe, it, expect, vi, afterEach } from "vitest";
import {
  CONVERSION_CSV_HEADER,
  GCLID_MAX_AGE_DAYS,
  OFFLINE_PURCHASE_CONVERSION,
  OFFLINE_SIGNUP_CONVERSION,
  conversionRowsForOrg,
  conversionRowsToCsv,
  feedWindowStart,
  formatAdsTime,
  type AttributedOrg,
  type PaidTopUp,
} from "../src/lib/ads-conversion-feed";
import { gclidFromCookie, isPlausibleGclid } from "../src/lib/gclid-cookie";
import { buildAdsConversionFeed, verifyFeedRequest, type FeedConfig } from "../src/lib/ads-conversion-feed-fetch";

/**
 * Google Ads bids on what it can SEE. The in-browser gtag reached it for about
 * one signup in six and for zero purchases, so the offline feed is the whole
 * signal max-conversions learns on — which makes the rules below load-bearing
 * rather than cosmetic: a row Google refuses (a click past 90 days, a purchase
 * dated before its own click) is a row that teaches nothing, and a fabricated
 * value is worse than a missing one.
 *
 * Both libs are alias-free on purpose, so these are real unit tests.
 */

const GCLID = "Cj0KCQiA1234567890abcdefghij";
const at = (iso: string) => new Date(iso);
const org = (gclidAt: string): AttributedOrg => ({ orgId: "org_1", gclid: GCLID, gclidAt: at(gclidAt) });
const topUp = (created: string, netCents: number): PaidTopUp => ({
  id: "pi_1",
  created: Math.floor(at(created).getTime() / 1000),
  netCents,
});

describe("the gclid comes off the cookie the conversion linker writes", () => {
  it("reads `_gcl_aw=GCL.<ts>.<gclid>`", () => {
    const parsed = gclidFromCookie(`foo=1; _gcl_aw=GCL.1757000000.${GCLID}; bar=2`);
    expect(parsed?.gclid).toBe(GCLID);
    expect(parsed?.clickedAt.toISOString()).toBe(new Date(1757000000 * 1000).toISOString());
  });

  it("is null when no ad click is recorded", () => {
    // Most visitors arrive with no gclid at all; that is not an error, it is a
    // signup the feed simply has nothing to say about.
    expect(gclidFromCookie("ph_session=abc; theme=dark")).toBeNull();
    expect(gclidFromCookie("")).toBeNull();
  });

  it("does not match a cookie whose NAME merely ends in _gcl_aw", () => {
    // A prefix match would read another vendor's cookie as our click id.
    expect(gclidFromCookie(`x_gcl_aw=GCL.1757000000.${GCLID}`)).toBeNull();
  });

  it("rejects a malformed timestamp rather than dating the click at the epoch", () => {
    expect(gclidFromCookie("_gcl_aw=GCL.0.abc")).toBeNull();
  });

  it("recognises a gclid and refuses anything that is not one", () => {
    expect(isPlausibleGclid(GCLID)).toBe(true);
    expect(isPlausibleGclid("short")).toBe(false);
    expect(isPlausibleGclid(`${GCLID},injected`)).toBe(false);
    expect(isPlausibleGclid("a".repeat(400))).toBe(false);
  });
});

describe("Google's own upload time format", () => {
  it("is `yyyy-MM-dd HH:mm:ss+00:00`, in UTC", () => {
    expect(formatAdsTime(at("2026-09-08T07:05:09.482Z"))).toBe("2026-09-08 07:05:09+00:00");
  });

  it("zero-pads every field, so a January morning parses", () => {
    expect(formatAdsTime(at("2026-01-02T03:04:05Z"))).toBe("2026-01-02 03:04:05+00:00");
  });
});

describe("what an attributed org contributes to the feed", () => {
  const since = at("2026-06-01T00:00:00Z");

  it("states the signup once, at the moment attribution was recorded", () => {
    const rows = conversionRowsForOrg(org("2026-07-01T10:00:00Z"), [], since);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gclid: GCLID,
      conversionName: OFFLINE_SIGNUP_CONVERSION,
      conversionValue: 1,
      currency: "USD",
    });
  });

  it("values a purchase at the dollars Stripe actually received", () => {
    const rows = conversionRowsForOrg(org("2026-07-01T10:00:00Z"), [topUp("2026-07-02T10:00:00Z", 2500)], since);
    const purchase = rows.find((r) => r.conversionName === OFFLINE_PURCHASE_CONVERSION);
    expect(purchase?.conversionValue).toBe(25);
  });

  it("nets a partial refund out of the value", () => {
    // netCents is `amount - amount_returned`: bidding on money we kept, not on
    // money that came back.
    const rows = conversionRowsForOrg(org("2026-07-01T10:00:00Z"), [topUp("2026-07-02T10:00:00Z", 2500 - 1000)], since);
    expect(rows.find((r) => r.conversionName === OFFLINE_PURCHASE_CONVERSION)?.conversionValue).toBe(15);
  });

  it("skips a top-up that received nothing", () => {
    // A $0 setup-mode card imprint and a fully-refunded charge are both real
    // PaymentIntents and neither is a purchase.
    const rows = conversionRowsForOrg(
      org("2026-07-01T10:00:00Z"),
      [topUp("2026-07-02T10:00:00Z", 0), topUp("2026-07-03T10:00:00Z", -500)],
      since,
    );
    expect(rows.map((r) => r.conversionName)).toEqual([OFFLINE_SIGNUP_CONVERSION]);
  });

  it("skips a payment that predates its own click", () => {
    // A click cannot have caused a charge that happened before it; Google
    // refuses the row, and shipping it would attribute an older customer's
    // money to a new ad.
    const rows = conversionRowsForOrg(org("2026-07-10T10:00:00Z"), [topUp("2026-07-01T10:00:00Z", 5000)], since);
    expect(rows.map((r) => r.conversionName)).toEqual([OFFLINE_SIGNUP_CONVERSION]);
  });

  it("drops a signup older than the window and keeps its later purchases out too", () => {
    // Both legs are past Google's match window, so neither can be uploaded.
    const rows = conversionRowsForOrg(org("2026-01-01T10:00:00Z"), [topUp("2026-02-01T10:00:00Z", 5000)], since);
    expect(rows).toEqual([]);
  });

  it("keeps a purchase inside the window under a signup that is outside it", () => {
    // The click is still matchable for the payment's own date; the signup is
    // not, so only the purchase ships. (Google matches on the click, not on
    // whether we happened to report the signup.)
    const rows = conversionRowsForOrg(org("2026-05-01T10:00:00Z"), [topUp("2026-07-01T10:00:00Z", 4000)], since);
    expect(rows.map((r) => r.conversionName)).toEqual([OFFLINE_PURCHASE_CONVERSION]);
  });
});

describe("the CSV is exactly what Google's bulk upload reads", () => {
  it("leads with the five column names the upload expects", () => {
    expect(CONVERSION_CSV_HEADER).toBe(
      "Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency",
    );
  });

  it("emits the header even with no rows, so an empty day is still a valid file", () => {
    expect(conversionRowsToCsv([])).toBe(`${CONVERSION_CSV_HEADER}\n`);
  });

  it("writes one line per row in the header's order", () => {
    const rows = conversionRowsForOrg(org("2026-07-01T10:00:00Z"), [topUp("2026-07-02T11:30:00Z", 2500)], at("2026-06-01T00:00:00Z"));
    expect(conversionRowsToCsv(rows).trim().split("\n")).toEqual([
      CONVERSION_CSV_HEADER,
      `${GCLID},offline_signup,2026-07-01 10:00:00+00:00,1,USD`,
      `${GCLID},offline_purchase,2026-07-02 11:30:00+00:00,25,USD`,
    ]);
  });

  it("names the two conversion actions byte-equal with the Ads account's own", () => {
    // These strings are the join with Google: an "Import from clicks" action
    // whose name differs by one character silently imports nothing.
    expect(OFFLINE_SIGNUP_CONVERSION).toBe("offline_signup");
    expect(OFFLINE_PURCHASE_CONVERSION).toBe("offline_purchase");
  });
});

describe("the rolling window", () => {
  it("defaults to the 90 days Google matches a click within", () => {
    expect(GCLID_MAX_AGE_DAYS).toBe(90);
    const now = at("2026-09-08T00:00:00Z");
    expect(feedWindowStart(now, null).toISOString()).toBe("2026-06-10T00:00:00.000Z");
  });

  it("honours an explicit ?since=", () => {
    expect(feedWindowStart(at("2026-09-08T00:00:00Z"), "2026-08-01").toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("throws on an unparseable ?since= rather than silently widening the window", () => {
    expect(() => feedWindowStart(at("2026-09-08T00:00:00Z"), "last-week")).toThrow(/invalid since/);
  });
});

const config: FeedConfig = {
  apiUrl: "https://api.example.test",
  adminApiKey: "admin-key",
  clerkSecretKey: "sk_test",
  feedToken: "feed-token",
};

describe("only the Ads Script's token opens the feed", () => {
  it("accepts the bearer token and nothing else", () => {
    const req = (auth: string | null) =>
      new Request("https://x.test/api/cron/ads-conversion-feed", auth ? { headers: { authorization: auth } } : {});
    expect(verifyFeedRequest(req("Bearer feed-token"), config)).toBe(true);
    expect(verifyFeedRequest(req("Bearer wrong"), config)).toBe(false);
    expect(verifyFeedRequest(req("feed-token"), config)).toBe(false);
    expect(verifyFeedRequest(req(null), config)).toBe(false);
  });
});

function stubFetch(handlers: { orgs: unknown; payments: (orgId: string) => { ok: boolean; body: unknown } }) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (href.includes("api.clerk.com")) {
      return new Response(JSON.stringify(handlers.orgs), { status: 200 });
    }
    const orgId = String((init?.headers as Record<string, string>)["x-external-org-id"]);
    const res = handlers.payments(orgId);
    return new Response(JSON.stringify(res.body), { status: res.ok ? 200 : 502 });
  }) as unknown as typeof fetch;
}

const clerkOrgs = (orgs: { id: string; gclid?: string; gclidAt?: string }[]) => ({
  total_count: orgs.length,
  data: orgs.map((o) => ({
    id: o.id,
    public_metadata: o.gclid ? { gclid: o.gclid, gclidAt: o.gclidAt, onboardingComplete: true } : {},
  })),
});

const payment = (id: string, created: string, amount: number, amount_returned = 0) => ({
  id,
  status: "succeeded",
  created: Math.floor(at(created).getTime() / 1000),
  amount,
  amount_returned,
});

afterEach(() => vi.restoreAllMocks());

describe("building the feed off Clerk + the billing read", () => {
  const since = at("2026-06-01T00:00:00Z");

  it("only orgs carrying a gclid are in it", async () => {
    const fetchFn = stubFetch({
      orgs: clerkOrgs([
        { id: "org_a", gclid: GCLID, gclidAt: "2026-07-01T10:00:00Z" },
        { id: "org_b" },
      ]),
      payments: () => ({ ok: true, body: { data: [] } }),
    });
    const result = await buildAdsConversionFeed(config, since, fetchFn);
    expect(result.attributedOrgs).toBe(1);
    expect(result.rows.map((r) => r.conversionName)).toEqual([OFFLINE_SIGNUP_CONVERSION]);
  });

  it("counts only what Stripe succeeded on", async () => {
    const fetchFn = stubFetch({
      orgs: clerkOrgs([{ id: "org_a", gclid: GCLID, gclidAt: "2026-07-01T10:00:00Z" }]),
      payments: () => ({
        ok: true,
        body: {
          data: [
            payment("pi_ok", "2026-07-02T10:00:00Z", 4000),
            { ...payment("pi_fail", "2026-07-03T10:00:00Z", 9900), status: "requires_payment_method" },
          ],
        },
      }),
    });
    const { rows } = await buildAdsConversionFeed(config, since, fetchFn);
    const purchases = rows.filter((r) => r.conversionName === OFFLINE_PURCHASE_CONVERSION);
    expect(purchases.map((p) => p.conversionValue)).toEqual([40]);
  });

  it("one org's failed payments read does not empty the feed", async () => {
    // An org that never reached checkout has no billing account and api-service
    // answers with a 5xx. Its signup still ships; every other org is untouched.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = stubFetch({
      orgs: clerkOrgs([
        { id: "org_broken", gclid: `${GCLID}A`, gclidAt: "2026-07-01T10:00:00Z" },
        { id: "org_ok", gclid: GCLID, gclidAt: "2026-07-01T10:00:00Z" },
      ]),
      payments: (orgId) =>
        orgId === "org_broken"
          ? { ok: false, body: { error: "no billing account" } }
          : { ok: true, body: { data: [payment("pi_ok", "2026-07-05T10:00:00Z", 3000)] } },
    });
    const result = await buildAdsConversionFeed(config, since, fetchFn);
    expect(result.failedOrgs).toBe(1);
    expect(result.rows.filter((r) => r.conversionName === OFFLINE_SIGNUP_CONVERSION)).toHaveLength(2);
    expect(result.rows.filter((r) => r.conversionName === OFFLINE_PURCHASE_CONVERSION)).toHaveLength(1);
    // Loud, not swallowed: the failure is named and the count rides the result.
    expect(err).toHaveBeenCalled();
  });

  it("sends the ONE system- principal, never an id keyed on the org", async () => {
    // The gateway upserts a `users` row on whatever x-external-user-id it gets;
    // an org-keyed id is one phantom user per org, forever.
    const fetchFn = stubFetch({
      orgs: clerkOrgs([{ id: "org_a", gclid: GCLID, gclidAt: "2026-07-01T10:00:00Z" }]),
      payments: () => ({ ok: true, body: { data: [] } }),
    });
    await buildAdsConversionFeed(config, since, fetchFn);
    const call = (fetchFn as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.find(([u]) =>
      u.includes("/v1/billing/payments"),
    );
    const headers = call?.[1].headers as Record<string, string>;
    expect(headers["x-external-user-id"]).toBe("system-ads-conversion-feed");
    expect(headers["x-external-org-id"]).toBe("org_a");
    expect(headers["X-API-Key"]).toBe("admin-key");
  });

  it("rows come out oldest first, so a day's upload reads as a timeline", async () => {
    const fetchFn = stubFetch({
      orgs: clerkOrgs([
        { id: "org_a", gclid: GCLID, gclidAt: "2026-07-10T10:00:00Z" },
        { id: "org_b", gclid: `${GCLID}B`, gclidAt: "2026-07-01T10:00:00Z" },
      ]),
      payments: () => ({ ok: true, body: { data: [] } }),
    });
    const { rows } = await buildAdsConversionFeed(config, since, fetchFn);
    expect(rows.map((r) => r.conversionTime.toISOString())).toEqual([
      "2026-07-01T10:00:00.000Z",
      "2026-07-10T10:00:00.000Z",
    ]);
  });

  it("an org whose gclidAt is unparseable is skipped, not dated now", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = stubFetch({
      orgs: clerkOrgs([{ id: "org_a", gclid: GCLID, gclidAt: "not-a-date" }]),
      payments: () => ({ ok: true, body: { data: [] } }),
    });
    const result = await buildAdsConversionFeed(config, since, fetchFn);
    expect(result.attributedOrgs).toBe(0);
    expect(err).toHaveBeenCalled();
  });

  it("a Clerk failure fails the WHOLE feed, since a short org list reads as a quiet day", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(buildAdsConversionFeed(config, since, fetchFn)).rejects.toThrow(/listOrganizations 500/);
  });
});
