import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The wiring around the offline-conversion feed, pinned at the CALL SITES.
 *
 * Every claim here is one a unit test cannot make: a tracker perfectly able to
 * fire on the onboarding return is the feature entirely absent if no layout
 * mounts it, and an attribution route that writes first-touch is worth nothing
 * if the signup never POSTs to it. All three are what actually broke —
 * Google Ads counted 10 signups where PostHog counted 66 with a gclid, and zero
 * purchases, because the purchase tracker was mounted only on the dashboard
 * layout while the product's main payment path returns on the onboarding one.
 */

const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");

describe("both checkout trackers accept BOTH return shapes", () => {
  // The billing top-up returns `?success=true`; the onboarding launch returns
  // `?launch_checkout=success`. Gating on the first alone is what made every
  // onboarding payment invisible to Google.
  const ads = read("src/components/ads-purchase-tracker.tsx");
  const sale = read("src/components/distribute-sale-tracker.tsx");

  it("the shared gate reads both params", () => {
    expect(ads).toContain('params.get("success") === "true"');
    expect(ads).toContain('params.get("launch_checkout") === "success"');
  });

  it("both trackers read the ONE gate rather than each testing a param", () => {
    // Two copies of the gate is how one of them comes to miss a return shape.
    expect(ads).toContain("isCheckoutReturn(searchParams)");
    expect(sale).toContain("isCheckoutReturn(searchParams)");
    expect(sale).toContain("import { isCheckoutReturn }");
  });

  it("neither still gates on `success` alone", () => {
    for (const src of [ads, sale]) {
      expect(src).not.toContain('searchParams.get("success") !== "true"');
    }
  });

  it("the Ads purchase still fires only on a real payment value", () => {
    // A $0 setup-mode card imprint reaches no `success_url` carrying a value;
    // firing without one would report a purchase that never happened.
    expect(ads).toContain("if (value === null) return;");
  });
});

describe("the onboarding layout mounts both trackers", () => {
  const layout = read("src/app/(authed)/onboarding/layout.tsx");

  it("renders them, so the launch return is observed where it lands", () => {
    expect(layout).toContain("<AdsPurchaseTracker />");
    expect(layout).toContain("<DistributeSaleTracker />");
  });

  it("imports them from the shared components, never a second copy", () => {
    expect(layout).toContain('from "@/components/ads-purchase-tracker"');
    expect(layout).toContain('from "@/components/distribute-sale-tracker"');
  });

  it("the dashboard layout keeps its own mount, for the billing top-up return", () => {
    const dash = read("src/app/(authed)/(dashboard)/layout.tsx");
    expect(dash).toContain("<AdsPurchaseTracker />");
    expect(dash).toContain("<DistributeSaleTracker />");
  });
});

describe("the signup records which ad click produced it", () => {
  const tracker = read("src/components/posthog-auth-tracker.tsx");

  it("POSTs the gclid from the same once-per-user signup branch", () => {
    expect(tracker).toContain("gclidFromCookie(document.cookie)");
    expect(tracker).toContain('fetch("/api/ads/attribution"');
  });

  it("is fire-and-forget, so a failed report never blocks a signup", () => {
    const at = tracker.indexOf('fetch("/api/ads/attribution"');
    expect(at).toBeGreaterThan(-1);
    expect(tracker.slice(at, tracker.indexOf("\n\n", at))).toContain(".catch(");
  });
});

describe("the attribution route is first-touch and org-scoped", () => {
  const route = read("src/app/(authed)/api/ads/attribution/route.ts");

  it("keeps an existing gclid rather than overwriting it", () => {
    // A later ad click by an existing customer is not a new acquisition;
    // overwriting would move the credit to a retargeting impression.
    expect(route).toContain("if (typeof existing === \"string\" && existing.length > 0)");
    expect(route).toContain("firstTouch: false");
  });

  it("refuses anything that is not a gclid", () => {
    expect(route).toContain("isPlausibleGclid(gclid)");
  });

  it("requires a signed-in user AND an active org", () => {
    expect(route).toContain('status: 401');
    expect(route).toContain('status: 403');
  });

  it("writes both fields through Clerk's deep-merging metadata update", () => {
    // updateOrganizationMetadata deep-merges, so `onboardingComplete` — the
    // first-run edge gate's only signal — survives this write.
    expect(route).toContain("updateOrganizationMetadata(orgId, {");
    expect(route).toContain("publicMetadata: { gclid, gclidAt:");
    expect(route).not.toContain("onboardingComplete: false");
  });
});

describe("the feed route", () => {
  const route = read("src/app/api/cron/ads-conversion-feed/route.ts");

  it("is bearer-gated before any work happens", () => {
    const gate = route.indexOf("verifyFeedRequest");
    const build = route.indexOf("buildAdsConversionFeed(");
    expect(gate).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(gate);
    expect(route).toContain("status: 401");
  });

  it("answers CSV, which is what the Ads Script parses", () => {
    expect(route).toContain('"Content-Type": "text/csv; charset=utf-8"');
    expect(route).toContain('"Cache-Control": "no-store"');
  });

  it("lives under /api/cron, the one prefix proxy.ts leaves public", () => {
    // An Ads Script carries no Clerk session, so a route behind the edge gate
    // would answer the sign-in page instead of the feed.
    expect(read("src/proxy.ts")).toContain('"/api/cron(.*)"');
    expect(fs.existsSync(path.join(__dirname, "../src/app/api/cron/ads-conversion-feed/route.ts"))).toBe(true);
  });

  it("states how many orgs it could not price, rather than hiding a partial feed", () => {
    expect(route).toContain("failedOrgs=");
  });
});

describe("the feed reads the job identity, never an org-keyed one", () => {
  const fetchLib = read("src/lib/ads-conversion-feed-fetch.ts");

  it("sends SERVICE_IDENTITY.adsConversionFeed", () => {
    expect(fetchLib).toContain('"x-external-user-id": SERVICE_IDENTITY.adsConversionFeed');
    // The shape that produced 89 phantom users: an id interpolating the org.
    expect(fetchLib).not.toMatch(/"x-external-user-id": `[a-z-]+:\$\{/);
  });

  it("stays alias-free, so it carries real unit tests", () => {
    expect(fetchLib).not.toMatch(/from "@\//);
    expect(read("src/lib/ads-conversion-feed.ts")).not.toMatch(/from "@?\.?/);
    expect(read("src/lib/gclid-cookie.ts")).not.toMatch(/^import /m);
  });
});
