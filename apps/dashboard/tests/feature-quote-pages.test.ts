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

    it("calls listQuoteRequests via useAuthQuery (no campaign filter)", () => {
      expect(content).toContain("listQuoteRequests");
      expect(content).toContain("useAuthQuery");
      expect(content).not.toMatch(/listQuoteRequests\(\s*\{[^}]*campaign_id/);
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

    it("renders the providerQuoteRequests array from the response", () => {
      expect(content).toContain("providerQuoteRequests");
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

    it("filters returned pitches to the current brandId", () => {
      expect(content).toMatch(/p\.brandId\s*===\s*brandId/);
    });

    it("exposes data-testid feature-quote-pitches-page", () => {
      expect(content).toContain('data-testid="feature-quote-pitches-page"');
    });

    it("includes a status filter select with the documented statuses", () => {
      expect(content).toContain('data-testid="feature-quote-pitches-status-filter"');
      for (const status of [
        "drafted",
        "submitted",
        "selected",
        "published",
        "not_selected",
        "error",
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
