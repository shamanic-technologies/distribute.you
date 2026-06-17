import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Static-shell-first reveal: a data card renders its frame + title + labels on
 * the first paint and skeletons ONLY the value/chart/number regions (gated by a
 * `pending` flag). This is the intermediate tier between "all skeleton" and "all
 * content". See CLAUDE.md → "Static-shell-first reveal".
 */
describe("static-shell-first: cards accept `pending` and skeleton only values", () => {
  const cards = [
    "components/revenue/revenue-cost-summary.tsx",
    "components/revenue/revenue-overview-section.tsx",
    "components/campaign/funnel-metrics.tsx",
    "components/campaign/reply-breakdown.tsx",
    "components/campaign/cost-breakdown.tsx",
    "components/campaign/campaign-cost-distribution.tsx",
    "components/campaign/leads-stats-panel.tsx",
    "components/brand-metrics-header.tsx",
    "components/visibility/score-card.tsx",
    "components/visibility/visibility-runs-view.tsx",
    "components/visibility/visibility-competitors-view.tsx",
    "components/visibility/visibility-prompts-view.tsx",
  ];

  it("every refactored card threads a pending/reveal flag and renders a Skeleton for values", () => {
    for (const rel of cards) {
      const src = read(rel);
      // Either a `pending` prop (page-driven) or an internal `revealed` latch
      // (self-managed, e.g. BrandMetricsHeader) sources the value-region gate.
      expect(src, `${rel} must thread a pending/reveal flag`).toMatch(/pending|revealed/i);
      expect(src, `${rel} must skeleton the value region`).toContain("Skeleton");
    }
  });

  it("BrandMetricsHeader renders the 4 metric titles always (no whole-card skeleton gate)", () => {
    const src = read("components/brand-metrics-header.tsx");
    expect(src).toContain('title="Monthly visits"');
    expect(src).toContain('title="Domain Rating"');
    expect(src).toContain('title="Est. monthly revenue"');
    expect(src).toContain('title="AI mentions"');
    // The skeleton now lives INSIDE the card (value region), not as a whole-card
    // early return — the title/frame paint before the value resolves. Each card
    // reveals on its OWN source via a per-card latch (a slow metric never holds
    // the others in skeleton), so there is no single shared `revealed` gate.
    expect(src).toContain("trafficRevealed");
    expect(src).toContain("drRevealed");
    expect(src).toContain("aiVisRevealed");
    expect(src).toMatch(/!trafficRevealed \?/);
  });

  it("RevenueCostSummary renders its labels outside the pending gate", () => {
    const src = read("components/revenue/revenue-cost-summary.tsx");
    // Labels are static text; values swap to Skeleton when pending.
    expect(src).toContain("Total spent");
    expect(src).toContain("Cost of acquisition");
    expect(src).toMatch(/pending \? \(\s*<Skeleton/);
  });
});

describe("static-shell-first: pages pass `pending`, not a whole-body skeleton swap", () => {
  // Feature routes were flattened up to the brand level (single-feature product);
  // the brand root page IS the overview now.
  const APP = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";

  it("feature overview reveals each card on its OWN data (per-card barriers, no single AND gate)", () => {
    const overview = read(`${APP}/page.tsx`);
    expect(overview).toContain("RevenueOverviewSection");
    // Revenue data (features-service) and Total-spent (runs-service) resolve on
    // different cold chains → separate latches, so the fast cost card never waits
    // on the slower revenue call. No single `valuesRevealed` AND of both queries.
    expect(overview).toContain("revenueRevealed");
    expect(overview).toContain("costRevealed");
    expect(overview).toContain("revenuePending={!revenueRevealed}");
    expect(overview).toContain("costPending={!costRevealed}");
    expect(overview).not.toContain("valuesRevealed");
  });

  it("campaigns page reveals each card on its OWN data (per-card barriers, no single whole-body gate)", () => {
    const campaigns = read(`${APP}/campaigns/page.tsx`);
    // Per-card reveal latches — the list paints on `campaigns` alone instead of
    // waiting for the slow features-service revenue/stats cold chain.
    expect(campaigns).toContain("listRevealed");
    expect(campaigns).toContain("chartsRevealed");
    expect(campaigns).toContain("heroRevealed");
    expect(campaigns).toContain("pending={!chartsRevealed}");
    // The old separate whole-card skeleton components are no longer imported/used.
    expect(campaigns).not.toContain("FunnelMetricsSkeleton");
    expect(campaigns).not.toContain("CostBreakdownSkeleton");
  });

});
