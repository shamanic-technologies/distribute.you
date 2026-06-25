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
  // The entity "Database" section (and with it the per-entity sidebar badges,
  // incl. quote-requests) was removed from the brand sidebar — lead data is now
  // surfaced via the overview's lead detail panel. There is no sidebar badge left
  // to diverge from the page, so the coherence concern is moot. Guard that the
  // badge machinery is gone (so it can't silently reappear out of sync).
  describe("brand sidebar (context-sidebar.tsx BrandLevelSidebar)", () => {
    it("no longer sources a quote-requests sidebar badge", () => {
      expect(contextSidebar).not.toContain("listAllRankedOpportunities");
      expect(contextSidebar).not.toMatch(/"quote-requests":/);
    });
  });
});
