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
  // The campaign/* cards (funnel-metrics, reply-breakdown, cost-breakdown,
  // campaign-cost-distribution, leads-stats-panel) were removed with the campaign
  // concept; the surviving static-shell cards are listed below.
  const cards = [
    "components/revenue/revenue-cost-summary.tsx",
    "components/revenue/revenue-overview-section.tsx",
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

  it("RevenueCostSummary renders its labels outside the pending gate", () => {
    const src = read("components/revenue/revenue-cost-summary.tsx");
    // Labels are static text; values swap to Skeleton when pending.
    expect(src).toContain("Total spent");
    expect(src).toContain("Top cost sources");
    expect(src).toMatch(/totalSpentPending \? \(\s*<Skeleton/);
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

  // The campaigns LIST page was removed with the campaign concept; the brand
  // overview block above is the surviving per-card-barrier guard.

});
