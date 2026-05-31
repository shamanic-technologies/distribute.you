import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const REQUESTS_PATH = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/quote-requests/page.tsx",
);
const PITCHES_PATH = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/quote-pitches/page.tsx",
);

describe("Feature-level quote pages", () => {
  describe("quote-requests page", () => {
    it("file exists at the feature route", () => {
      expect(fs.existsSync(REQUESTS_PATH)).toBe(true);
    });

    const content = fs.readFileSync(REQUESTS_PATH, "utf-8");

    it("is a client component", () => {
      expect(content).toContain('"use client"');
    });

    it("default exports FeatureQuoteRequestsPage", () => {
      expect(content).toContain("export default function FeatureQuoteRequestsPage");
    });

    it("reads the gold catalog via listRankedOpportunities (NOT silver listQuoteRequests)", () => {
      // Coherence fix: the feature page must read the SAME GET /orgs/opportunities
      // (gold, scored) surface the sidebar badge counts, so badge == page count.
      expect(content).toContain("listRankedOpportunities");
      expect(content).toContain("useAuthQuery");
      expect(content).not.toContain("listQuoteRequests");
      expect(content).not.toContain("providerQuoteRequests");
    });

    it("is brand-scoped (no campaignId) — brand-set wide 'across all campaigns'", () => {
      expect(content).not.toMatch(/listRankedOpportunities\(\s*\{[^}]*campaignId/);
    });

    it("uses the shared pollOptionsSlow cadence", () => {
      expect(content).toContain("pollOptionsSlow");
    });

    it("renders an EntitySearchBar with totalCount", () => {
      expect(content).toContain("EntitySearchBar");
      expect(content).toContain("totalCount");
    });

    it("exposes data-testid feature-quote-requests-page", () => {
      expect(content).toContain('data-testid="feature-quote-requests-page"');
    });

    it("renders the gold opportunities array with the relevance score", () => {
      expect(content).toContain("opportunities");
      expect(content).toContain(".score");
    });

    it("renders the score directly as a percent — never `score * 100` (was '9500')", () => {
      // Relevance judge (DIS-79) emits a 0–100 score (e.g. 95). Render it
      // directly: `Math.round(opportunity.score)` + '%'. `* 100` produced "9500".
      expect(content).not.toMatch(/score\s*\*\s*100/);
      expect(content).toContain("Math.round(opportunity.score)");
    });

    it("renders an empty state with the matching testid", () => {
      expect(content).toContain('data-testid="feature-quote-requests-empty"');
    });
  });

  describe("quote-pitches page", () => {
    it("file exists at the feature route", () => {
      expect(fs.existsSync(PITCHES_PATH)).toBe(true);
    });

    const content = fs.readFileSync(PITCHES_PATH, "utf-8");

    it("is a client component", () => {
      expect(content).toContain('"use client"');
    });

    it("default exports FeatureQuotePitchesPage", () => {
      expect(content).toContain("export default function FeatureQuotePitchesPage");
    });

    it("calls listQuotePitches via useAuthQuery (no campaign filter)", () => {
      expect(content).toContain("listQuotePitches");
      expect(content).toContain("useAuthQuery");
      expect(content).not.toMatch(/listQuotePitches\(\s*\{[^}]*campaignId/);
    });

    it("uses the shared pollOptionsSlow cadence", () => {
      expect(content).toContain("pollOptionsSlow");
    });

    it("filters returned pitches to the current brandId (brandIds is a string[] on the wire)", () => {
      expect(content).toMatch(/p\.brandIds\.includes\(brandId\)/);
      expect(content).not.toMatch(/p\.brandId\s*===\s*brandId/);
    });

    it("reads the wire response key `quotePitches` (not the legacy `pitches`)", () => {
      expect(content).toContain("data?.quotePitches");
      expect(content).not.toMatch(/data\.pitches\b/);
      expect(content).not.toMatch(/data\?\.pitches\b/);
    });

    it("exposes data-testid feature-quote-pitches-page", () => {
      expect(content).toContain('data-testid="feature-quote-pitches-page"');
    });

    it("includes a status filter select with every status the wire enum declares", () => {
      expect(content).toContain('data-testid="feature-quote-pitches-status-filter"');
      // 10 statuses per journalists-quotes-service GET /orgs/quote-pitches openapi (verified 2026-05-28)
      for (const status of [
        "drafted",
        "submitted",
        "selected",
        "published",
        "not_selected",
        "error",
        "length_violation",
        "template_missing",
        "brand_missing_fields",
        "insufficient_credits",
      ]) {
        expect(content).toContain(`"${status}"`);
      }
    });

    it("renders an EntitySearchBar with totalCount", () => {
      expect(content).toContain("EntitySearchBar");
      expect(content).toContain("totalCount");
    });

    it("renders an empty state with the matching testid", () => {
      expect(content).toContain('data-testid="feature-quote-pitches-empty"');
    });
  });
});
