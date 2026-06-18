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
 * SAME gold endpoint via `listAllRankedOpportunities` (which pages through the
 * whole catalog — no 50-row cap), and the sidebar badge is sourced from that same
 * fetch so badge == page count at all times.
 */

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, rel), "utf-8");

const contextSidebar = read("../src/components/context-sidebar.tsx");

describe("quote-requests badge ↔ page coherence (gold catalog single source)", () => {
  // The campaign sidebar (sidebar-wrapper.tsx) was deleted with the campaign
  // concept; the brand-level sidebar is the survivor.
  describe("brand sidebar (context-sidebar.tsx BrandLevelSidebar)", () => {
    it("imports listAllRankedOpportunities", () => {
      expect(contextSidebar).toContain("listAllRankedOpportunities");
    });

    it("sources the quote-requests badge from the OPEN (non-pitched) gold opportunities (badge == page)", () => {
      expect(contextSidebar).toContain("isOpportunityOpen");
      expect(contextSidebar).toMatch(/"quote-requests":[\s\S]*?isOpportunityOpen/);
    });
  });
});
