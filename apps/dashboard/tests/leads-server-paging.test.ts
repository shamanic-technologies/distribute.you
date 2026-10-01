import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * The Leads page asks lead-service for one page at a time.
 *
 * It used to read a brand's ENTIRE lead population and derive the tab counts, the search,
 * the sort, the export and the board from that one array. Measured in production: 44.5 MB
 * over 12,945 rows on one brand, 99 MB on the largest of the seven past the limit — far
 * over `MAX_PERSISTED_ENTRY_BYTES`, so the entry was refused at write time, was never on
 * disk, and the table cold-loaded on EVERY visit. That is the loading skeleton customers
 * reported: not a caching bug, a payload that could not be cached.
 *
 * These guard the reader and the persisted cache. The rules themselves (which bucket a tab asks for, what the
 * search box may send, how many pages a total makes) are REAL unit tests in
 * `leads-server-page.test.ts` — the module is alias-free precisely so they can be.
 */
const ROOT = resolve(__dirname, "..");
const API = readFileSync(resolve(ROOT, "src/lib/api.ts"), "utf8");
const PERSIST = readFileSync(resolve(ROOT, "src/lib/persist-cache.ts"), "utf8");

describe("the paged leads readers", () => {
  it("allowlists the new roots, or the page cold-loads exactly as it did before", () => {
    // An unlisted root is default-OFF: the whole point of a small payload is that it can
    // be written to disk.
    expect(PERSIST).toContain('"leadsPage"');
    expect(PERSIST).toContain('"leadBucketCounts"');
  });

  it("lets the producer stream the export instead of assembling a second one", () => {
    // It walked the filter page by page for a while, purely to control the column
    // headings — lead-service headed them with the API's field names. It heads them in
    // the customer's words as of v0.70.0, so the walk (a 25,000-row ceiling and megabytes
    // of transient traffic on a press) had nothing left to buy.
    expect(API).toContain("export async function fetchLeadsCsv(");
    expect(API).toContain('format: "csv"');
    expect(API).not.toContain("fetchLeadsForExport");
    expect(API).not.toContain("EXPORT_MAX_ROWS");
    // Through `apiCall`, so the export carries the same per-tab bearer and the same
    // org-desync retry as every other read rather than being a second auth path.
    expect(API).toContain('responseType: "text"');
  });

  it("parses the rows through the SAME reader every other leads read uses", () => {
    // A page and a full read disagreeing about a lead's shape is one bug in two places.
    expect(API).toContain('parseLeadsResponse(raw, "listLeadsPage")');
  });
});
