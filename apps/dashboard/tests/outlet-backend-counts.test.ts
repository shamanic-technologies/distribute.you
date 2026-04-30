import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { deriveDisplayStatusFromCounts } from "../src/lib/outlet-status";
import type { OutletStatusCounts } from "../src/lib/api";

const brandOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
);
const featureOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/outlets/page.tsx",
);

describe("outlet pages use client-side grouping for tab counts (not cumulative byOutreachStatus)", () => {
  for (const [label, pagePath] of [
    ["brand-level", brandOutletPagePath],
    ["feature-level", featureOutletPagePath],
  ] as const) {
    describe(label, () => {
      const content = fs.readFileSync(pagePath, "utf-8");

      it("should NOT use byOutreachStatus for tab counts (cumulative, causes mismatches)", () => {
        const codeLines = content.split("\n").filter((l: string) => !l.trimStart().startsWith("//"));
        const codeOnly = codeLines.join("\n");
        expect(codeOnly).not.toContain("byOutreachStatus");
      });

      it("should use outlets.length for tab and header counts (not data?.total which is journalist count)", () => {
        expect(content).not.toMatch(/data\?\.total/);
      });

      it("should use groupedByStatus for tab counts (client-side watermark)", () => {
        expect(content).toContain("groupedByStatus");
      });
    });
  }
});

describe("deriveDisplayStatusFromCounts handles cumulative counts correctly", () => {
  it("picks highest watermark when all counts are non-zero (cumulative)", () => {
    const counts: OutletStatusCounts = {
      buffered: 5, claimed: 5, served: 5, skipped: 0,
      contacted: 3, sent: 3, delivered: 2, opened: 1,
      clicked: 0, replied: 0, repliesPositive: 0, repliesNegative: 0,
      repliesNeutral: 0, bounced: 0, unsubscribed: 0,
    };
    expect(deriveDisplayStatusFromCounts(counts)).toBe("opened");
  });

  it("returns 'claimed' when only buffered and claimed are non-zero", () => {
    const counts: OutletStatusCounts = {
      buffered: 3, claimed: 3, served: 0, skipped: 0,
      contacted: 0, sent: 0, delivered: 0, opened: 0,
      clicked: 0, replied: 0, repliesPositive: 0, repliesNegative: 0,
      repliesNeutral: 0, bounced: 0, unsubscribed: 0,
    };
    expect(deriveDisplayStatusFromCounts(counts)).toBe("claimed");
  });

  it("returns 'sent' when sent > 0 but delivered/opened are 0", () => {
    const counts: OutletStatusCounts = {
      buffered: 2, claimed: 2, served: 2, skipped: 0,
      contacted: 1, sent: 1, delivered: 0, opened: 0,
      clicked: 0, replied: 0, repliesPositive: 0, repliesNegative: 0,
      repliesNeutral: 0, bounced: 0, unsubscribed: 0,
    };
    expect(deriveDisplayStatusFromCounts(counts)).toBe("sent");
  });

  it("returns 'open' when counts is null", () => {
    expect(deriveDisplayStatusFromCounts(null)).toBe("open");
  });

  it("returns 'open' when all counts are zero", () => {
    const counts: OutletStatusCounts = {
      buffered: 0, claimed: 0, served: 0, skipped: 0,
      contacted: 0, sent: 0, delivered: 0, opened: 0,
      clicked: 0, replied: 0, repliesPositive: 0, repliesNegative: 0,
      repliesNeutral: 0, bounced: 0, unsubscribed: 0,
    };
    expect(deriveDisplayStatusFromCounts(counts)).toBe("open");
  });

  it("returns 'replied-positive' when repliesPositive > 0", () => {
    const counts: OutletStatusCounts = {
      buffered: 1, claimed: 1, served: 1, skipped: 0,
      contacted: 1, sent: 1, delivered: 1, opened: 1,
      clicked: 0, replied: 1, repliesPositive: 1, repliesNegative: 0,
      repliesNeutral: 0, bounced: 0, unsubscribed: 0,
    };
    expect(deriveDisplayStatusFromCounts(counts)).toBe("replied-positive");
  });
});
