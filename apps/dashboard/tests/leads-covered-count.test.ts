import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The Leads page must describe ONE population. Every tab is an engagement step
// (contacted / clicked / replied / outcome), so a lead served with no delivery
// evidence lands in no bucket and is unreachable from the page. Counting the raw
// list in the header advertised rows the table could never show — the reported
// "(6 leads)" over a 5-row Outreach tab whose stat card also read 5.
//
// The module imports through the `@` alias (unresolved by vitest here), so these
// are source-substring guards over the relevant slices, not runtime calls.
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
  it("derives the covered population from the visible tabs' buckets", () => {
    const body = sliceFrom("const coveredLeads = useMemo(", 600);
    expect(body).toContain("for (const tab of visibleTabs)");
    expect(body).toContain("groupedByTab.get(tab)");
    // Deduped: the tabs are nested subsets (positive replies ⊂ outreach), never a partition.
    expect(body).toContain("new Set<string>()");
    // Rendered in the base "all" ordering the table already uses.
    expect(body).toContain("sortedLeads.filter");
  });

  it("renders the covered count in the title, not the raw list length", () => {
    const header = sliceFrom("<h1 className=", 700);
    expect(header).toContain('({coveredLeads.length.toLocaleString("en-US")} leads)');
    expect(header).not.toContain("leads.length.toLocaleString");
  });

  it("exports the covered population, so the CSV matches the count on screen", () => {
    const csv = sliceFrom("const leadsCsv = useMemo(", 300);
    expect(csv).toContain("buildLeadsCsv(coveredLeads");
    const button = sliceFrom("<CsvDownloadButton", 220);
    expect(button).toContain("isEmpty={coveredLeads.length === 0}");
  });

  it("shows the empty card when nothing is reachable, even if rows were served", () => {
    expect(src).toContain("{coveredLeads.length === 0 ? (");
    expect(src).not.toContain("{leads.length === 0 ? (");
  });
});
