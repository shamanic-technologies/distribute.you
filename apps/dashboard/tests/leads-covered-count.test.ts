import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The Leads page must describe ONE population, and it must be a population the tabs can
// actually reach. Every tab is an engagement step (contacted / clicked / replied /
// outcome), so a lead lead-service served with no delivery evidence lands in no bucket
// and cannot be shown — the reported "(6 leads)" over a 5-row Outreach tab.
//
// The page no longer HOLDS the population, so this is no longer a set it computes: it is
// a count lead-service states. The invariant is unchanged and the risk moved — the wrong
// number to render is now `bucket-counts.total`, which counts the evidence-less people
// too (about 5,000 of 12,945 on the brand that surfaced the skeleton).
//
// The module imports through the `@` alias (unresolved by vitest here), so these are
// source-substring guards over the relevant slices, not runtime calls. The rule itself is
// unit-tested in `leads-server-page.test.ts`.
const src = fs.readFileSync(
  path.resolve(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
  "utf-8",
);

const sliceFrom = (marker: string, len: number) => {
  const i = src.indexOf(marker);
  expect(i, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(i, i + len);
};

describe("EngagedLeadsPage — the header count matches what the tabs can reach", () => {
  it("reads the reachable population from the producer, never from the loaded page", () => {
    expect(src).toContain("const reachableCount = reachablePopulation(bucketCounts);");
    // The page holds ONE page of rows now; counting them would state "50 leads" for a
    // brand with thousands.
    expect(src).not.toContain("leads.length.toLocaleString");
  });

  it("renders that count in the title", () => {
    const header = sliceFrom("<h1 className=", 800);
    expect(header).toContain('({reachableCount.toLocaleString("en-US")} leads)');
  });

  it("never renders the scoped total, which counts people no tab can reach", () => {
    expect(src).not.toContain("bucketCounts.total");
    expect(src).not.toContain("bucketCounts?.total");
  });

  it("exports what the page is showing — the active tab, the active search", () => {
    const button = sliceFrom("<CsvDownloadButton", 700);
    expect(button).toContain("fetchLeadsForExport(");
    expect(button).toContain("leadsPageQuery({ tab: activeTab, search: wireSearch");
    expect(button).toContain("isEmpty={reachableCount === 0}");
    // The file keeps the dashboard's own column vocabulary ("Contacted", "Website
    // visit") rather than lead-service's `?format=csv`, whose columns are the wire's
    // names. An export that disagrees with the screen it came from is the same bug one
    // file over.
    expect(button).toContain("buildLeadsCsv(all,");
  });

  it("shows the empty card off the reachable count, not off the served rows", () => {
    expect(src).toContain("{reachableCount === 0 ? (");
    expect(src).not.toContain("{leads.length === 0 ? (");
  });

  it("states the export cap rather than silently exporting the first N", () => {
    const button = sliceFrom("<CsvDownloadButton", 700);
    expect(button).toContain("truncated");
    expect(button).toContain("EXPORT_MAX_ROWS");
  });
});
