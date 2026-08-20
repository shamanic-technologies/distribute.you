import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Reveal-on-SETTLE: the brand Overview gates every revenue-driven region on the
 * `/revenue` query SETTLING (resolved OR errored), never success-only. `/revenue`
 * is the slowest cold chain and intermittently fails on a cold backend (features
 * → downstream Neon scale-to-zero); gating reveal on `data !== undefined` alone
 * left the whole section skeletoned FOREVER on a transient error, with no error
 * UI and no recovery. This is the durable fix behind the recurring "overview
 * still shows skeleton" reports (sibling of #2574/#2576 backend-down → stale).
 * See CLAUDE.md → local-first cache "backend-DOWN must degrade to STALE".
 */
describe("brand overview reveals on settle (error must not eternally skeleton)", () => {
  const overview = read(
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );

  it("destructures isError from the /revenue query", () => {
    expect(overview).toContain("isError: revenueIsError");
  });

  it("revenue reveal gates on SETTLE (data present OR error), not success-only", () => {
    expect(overview).toContain(
      "const revenueSettled = data !== undefined || revenueIsError;",
    );
    expect(overview).toContain("useCoordinatedReveal([revenueSettled])");
    // The old success-only barrier must be gone.
    expect(overview).not.toContain("useCoordinatedReveal([data !== undefined])");
  });

  it("the graph + stats + audience barriers also settle on error", () => {
    expect(overview).toContain("|| pipelineIsError");
    expect(overview).toContain("|| featureStatsIsError");
    expect(overview).toContain("|| audienceStatsIsError");
    // The outcome-projection barrier went with its query: it resolved a workflow for a
    // goal a brand does not have, and fed a forecast the Return-on-spend chart replaced.
    expect(overview).not.toContain("outcomeIsError");
  });

  it("keeps the per-card-barrier props (no single page-wide AND gate)", () => {
    expect(overview).toContain("revenuePending={!revenueRevealed}");
    expect(overview).toContain("costPending={!costRevealed}");
    expect(overview).not.toContain("valuesRevealed");
  });
});

describe("RevenueOverviewSection drops the defensive !data re-guard", () => {
  const section = read("components/revenue/revenue-overview-section.tsx");

  it("revenueLoading tracks revenuePending alone", () => {
    expect(section).toContain("const revenueLoading = revenuePending;");
    // The `|| !data` re-guard would re-lock the section into an eternal skeleton
    // on an errored /revenue (revenuePending false, data undefined).
    expect(section).not.toContain("revenuePending || !data");
  });

  // Same defect, one endpoint over: `pipeline-activity` 502'd for ~20 minutes on
  // 2026-08-08 and the `|| !pipelineActivity` re-guard turned that into a
  // permanent-looking skeleton across the Outcome card AND the activity chart,
  // with no error text and no retry affordance.
  it("activityLoading tracks activityPending alone", () => {
    expect(section).toContain("const activityLoading = activityPending;");
    expect(section).not.toContain("activityPending || !pipelineActivity");
  });

  it("an absent activity payload renders a stated reason, not a skeleton", () => {
    expect(section).toContain(") : !pipelineActivity ? (");
    expect(section).toContain("We could not load your outreach activity");
  });

  // The Outcome card's cumulative line is `pipelineActualSeries`, which rides the
  // `/revenue` payload — an outage on an endpoint it does not read must not blank it.
  it("the Outcome card gates on revenue, not on activity", () => {
    const at = section.indexOf("<OutcomeTrendCard");
    expect(at).toBeGreaterThan(-1);
    // Measured: the element is 176 chars; padded to stay inside it.
    expect(section.slice(at, at + 240)).toContain("pending={revenueLoading}");
  });
});

/**
 * The money on the brand / offer Overview is asked at the grain the PAGE is.
 *
 * A feature IS an acquisition channel in this fleet, so the per-feature read answers
 * "what did this return THROUGH THIS ONE CHANNEL". While a brand ran one channel that
 * was the same answer as the brand's; it stopped being so the day a second was funded,
 * and the page then paired one channel's spend with billing's brand-wide ceiling and
 * read `$40 / 50` for a brand whose channels had spent $40.07 and $10.32 against their
 * own $40 and $10 — both halves real, about different things, nothing erroring.
 */
describe("brand / offer Overview asks for its own grain, not one channel's", () => {
  const page = fs.readFileSync(
    path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"),
    "utf-8",
  );
  const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

  it("reads the offer grain when an offer is open, the brand grain otherwise", () => {
    expect(page).toContain("offerId ? getOfferRevenue(offerId, brandId) : getBrandRevenue(brandId)");
    // The per-feature read answers for ONE channel and must not come back to this page.
    expect(page).not.toContain("getFeatureRevenue(");
  });

  it("keys carry the grain, so the two answers cannot share a cache entry", () => {
    expect(page).toContain('["offerRevenue", brandId, offerId]');
    expect(page).toContain('["brandRevenue", brandId]');
  });

  it("both readers exist and share ONE parser", () => {
    expect(api).toContain("export async function getOfferRevenue");
    expect(api).toContain("export async function getBrandRevenue");
    // The money block a consumer renders is identical at all three grains, so a
    // second parser would be a second place for it to drift.
    expect(api).toContain('parseFeatureRevenue(raw, "getOfferRevenue")');
    expect(api).toContain('parseFeatureRevenue(raw, "getBrandRevenue")');
  });

  it("asks for the NET basis, like every other money read", () => {
    // Coherent with the NET-paced budget, so `spent today / budget` cannot exceed
    // 100% for a discounted org.
    const at = api.indexOf("export async function getBrandRevenue");
    expect(api.slice(at, at + 400)).toContain('pricing: "net"');
  });

  it("never sums the per-channel breakdown in the browser", () => {
    // features-service combines the parts because most of them do not add — a lead
    // worked through two channels is one lead, and a ratio of sums is neither the sum
    // nor the average of ratios. Measured: 1408 chars from the offer reader's
    // signature to the brand reader's closing brace. Do NOT pad a not-toContain
    // slice — running past them reads neighbouring code and fails on correct code.
    const at = api.indexOf("export async function getOfferRevenue");
    const readers = api.slice(at, at + 1408);
    expect(readers).not.toContain("reduce");
    expect(readers).not.toContain("+=");
  });

  it("both roots are persistable, or the money block cold-skeletons every visit", () => {
    const persist = fs.readFileSync(path.join(__dirname, "../src/lib/persist-cache.ts"), "utf-8");
    expect(persist).toContain('"offerRevenue"');
    expect(persist).toContain('"brandRevenue"');
  });
});
