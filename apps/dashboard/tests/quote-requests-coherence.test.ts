import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Coherence regression (distribute.you "142 in sidebar, empty page"):
 *
 * The `quote-requests` entity (feature `pr-expert-quote-opportunities`) had a
 * badge ↔ page divergence. The badge fell through to the feature-stats
 * `quoteRequestsFound` (SILVER pool, provider_quote_requests = 142) while the
 * pages render the GOLD catalog (GET /orgs/opportunities, scored above
 * SCORE_THRESHOLD = 0 until a scoring run). Every other entity badge already
 * mirrors its page via `listingFallback`; `quote-requests` was the one entity
 * missing from it.
 *
 * Fix: every quote-requests surface (both sidebars + the feature page) reads the
 * SAME gold endpoint via `listRankedOpportunities`, and the sidebar badge is
 * sourced from that endpoint's `total` so badge == page count at all times.
 */

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, rel), "utf-8");

const sidebarWrapper = read(
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/sidebar-wrapper.tsx",
);
const contextSidebar = read("../src/components/context-sidebar.tsx");

describe("quote-requests badge ↔ page coherence (gold catalog single source)", () => {
  describe("campaign sidebar (sidebar-wrapper.tsx)", () => {
    it("imports listRankedOpportunities (the gold GET /orgs/opportunities reader)", () => {
      expect(sidebarWrapper).toContain("listRankedOpportunities");
    });

    it("sources the quote-requests badge from the gold catalog total", () => {
      expect(sidebarWrapper).toMatch(/"quote-requests":\s*\w+\?\.total/);
    });
  });

  describe("feature sidebar (context-sidebar.tsx FeatureLevelSidebar)", () => {
    it("imports listRankedOpportunities", () => {
      expect(contextSidebar).toContain("listRankedOpportunities");
    });

    it("sources the quote-requests badge from the gold catalog total", () => {
      expect(contextSidebar).toMatch(/"quote-requests":\s*\w+\?\.total/);
    });
  });
});
