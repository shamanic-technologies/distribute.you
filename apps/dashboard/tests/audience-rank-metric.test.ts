import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  audienceRankMetric,
  AUDIENCE_RANK_METRIC_INFO,
  AUDIENCE_RANK_METRIC_LABEL,
  AUDIENCE_RANK_METRIC_OUTCOME_NOUN,
  type AudienceRankMetric,
} from "../src/lib/strategy-model";
import type { BrandOptimizationGoal } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// Regression: a `website_purchase` brand read "CPPR $319 / 0 replies" in the Overview's
// Top-3-audiences card while its Audiences page hid the reply columns entirely for the same
// brand at the same moment. The website-purchase funnel is visit -> signup -> paid; there is
// no reply step to divide by, so the card was pricing an outcome the brand does not pursue.
//
// Cause: the card read the `sortMetric` features-service returns, and features classes
// websitePurchase + sales as reply-driven (`sortMetric: "cppr"`). The Audiences page never
// read that field — it derived its own column from the brand goal. Two independent decisions
// for one question. `audienceRankMetric` is now the single home, and the card ignores
// `sortMetric` exactly like the Audiences page always did.

describe("audienceRankMetric — the brand's goal decides the column, never the wire", () => {
  it("prices a website_purchase brand on the funnel step it measures, never CPPR", () => {
    expect(audienceRankMetric("website_purchase", false)).toBe("cpc");
  });

  it("leads with the sale outcome once the conversion tracker is live", () => {
    expect(audienceRankMetric("website_purchase", true)).toBe("cpsale");
    expect(audienceRankMetric("sales", true)).toBe("cpsale");
  });

  it("falls back to the measured visit cost when no tracker attributes the outcome", () => {
    // With no tracker there are no attributed signups / form submissions / sales, so the
    // outcome column would only ever print "-". Cost per website visit is real.
    expect(audienceRankMetric("sales", false)).toBe("cpc");
    expect(audienceRankMetric("signups", false)).toBe("cpc");
    expect(audienceRankMetric("form_submissions", false)).toBe("cpc");
  });

  it("leads with the visit-driven outcome costs when the tracker is live", () => {
    expect(audienceRankMetric("signups", true)).toBe("cps");
    expect(audienceRankMetric("form_submissions", true)).toBe("cpfs");
  });

  it("keeps the reply goals on CPPR regardless of the tracker", () => {
    // Replies come from the email gateway, not the site pixel.
    for (const tracker of [true, false]) {
      expect(audienceRankMetric("sales_meetings", tracker)).toBe("cppr");
      expect(audienceRankMetric("positive_replies", tracker)).toBe("cppr");
    }
  });

  it("keeps a website_visits brand on the visit cost", () => {
    expect(audienceRankMetric("website_visits", true)).toBe("cpc");
    expect(audienceRankMetric("website_visits", false)).toBe("cpc");
  });

  it("answers every goal the brand can pick", () => {
    const goals: BrandOptimizationGoal[] = [
      "signups",
      "sales_meetings",
      "website_visits",
      "positive_replies",
      "form_submissions",
      "website_purchase",
      "sales",
    ];
    const allowed = new Set(["cppr", "cps", "cpfs", "cpsale", "cpc"]);
    for (const goal of goals) {
      for (const tracker of [true, false]) {
        expect(allowed.has(audienceRankMetric(goal, tracker))).toBe(true);
      }
    }
  });
});

describe("every metric carries its own words", () => {
  const metrics: AudienceRankMetric[] = ["cppr", "cps", "cpfs", "cpsale", "cpc"];

  it("has a label, a tooltip and an outcome noun for each", () => {
    for (const metric of metrics) {
      expect(AUDIENCE_RANK_METRIC_LABEL[metric].length).toBeGreaterThan(0);
      expect(AUDIENCE_RANK_METRIC_INFO[metric].length).toBeGreaterThan(0);
      expect(AUDIENCE_RANK_METRIC_OUTCOME_NOUN[metric].length).toBeGreaterThan(0);
    }
  });

  it("uses the same words the Audiences table already prints", () => {
    const src = read("../src/components/audiences/customer-audiences-page.tsx");
    for (const metric of metrics) {
      expect(src).toContain(`label="${AUDIENCE_RANK_METRIC_LABEL[metric]}"`);
      expect(src).toContain(AUDIENCE_RANK_METRIC_INFO[metric]);
    }
  });
});

describe("the Top-3 card decides its own column and orders by it", () => {
  const card = read("../src/components/revenue/top-audiences-card.tsx");

  it("never falls back to the wire's sortMetric", () => {
    expect(card).not.toMatch(/data\?\.sortMetric/);
  });

  it("reads its label + tooltip + noun from the shared records", () => {
    expect(card).toContain("AUDIENCE_RANK_METRIC_LABEL[metric]");
    expect(card).toContain("AUDIENCE_RANK_METRIC_INFO[metric]");
    expect(card).toContain("AUDIENCE_RANK_METRIC_OUTCOME_NOUN[metric]");
  });

  it("sorts on the shown metric before taking the top 3", () => {
    // A card that displays one field while the server ordered the rows by another reads
    // as broken in a new way.
    const at = card.indexOf("const statsRows");
    expect(at).toBeGreaterThan(-1);
    const block = card.slice(at, card.indexOf(".slice(0, 3)", at) + 20);
    expect(block).toContain("metricCents(metric, a)");
    expect(block).toContain("metricCents(metric, b)");
  });
});

describe("both Overview surfaces let the card pick the top 3", () => {
  for (const rel of [
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
    "../src/components/campaigns/campaign-overview-page.tsx",
  ]) {
    it(`${rel.split("/").pop()} drops the server-side limit`, () => {
      // features-service applies `limit` AFTER sorting by ITS OWN sortMetric, so a limit
      // hands the card three rows chosen on a column it does not show.
      const src = read(rel);
      const at = src.indexOf("fetchFeatureAudienceStats(featureSlug, {");
      expect(at).toBeGreaterThan(-1);
      expect(src.slice(at, at + 200)).not.toContain("limit:");
    });
  }
});

describe("the Audiences table reads the same helper", () => {
  it("seeds its default sort column from audienceRankMetric", () => {
    const src = read("../src/components/audiences/customer-audiences-page.tsx");
    // The whole STATEMENT, not one line: the default is a ternary spanning three lines
    // since brand level took its own column, and a line-scoped read would cut the
    // helper call out of the haystack and fail on correct code.
    const at = src.indexOf("const defaultSortCol");
    expect(at).toBeGreaterThan(-1);
    const line = src.slice(at, src.indexOf(";", at) + 1);
    expect(line).toContain("audienceRankMetric(optimizationGoal, trackerSetUp)");
    // At BRAND level the table states money instead, and leads with RETURN — highest
    // first, because cost per outcome ranks by cheapness and would put an audience
    // converting to nothing above an expensive one that pays. The shared helper still
    // decides every campaign-level default.
    expect(line).toContain("brandLevelMoney");
  });
});
