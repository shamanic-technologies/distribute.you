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
 * These are call-site guards. The rules themselves (which bucket a tab asks for, what the
 * search box may send, how many pages a total makes) are REAL unit tests in
 * `leads-server-page.test.ts` — the module is alias-free precisely so they can be.
 */
const ROOT = resolve(__dirname, "..");
const PAGE = readFileSync(resolve(ROOT, "src/components/audiences/engaged-leads-page.tsx"), "utf8");
const API = readFileSync(resolve(ROOT, "src/lib/api.ts"), "utf8");
const PERSIST = readFileSync(resolve(ROOT, "src/lib/persist-cache.ts"), "utf8");

describe("the Leads page pages instead of holding the population", () => {
  it("reads a page and the bucket counts, and nothing whole-population", () => {
    expect(PAGE).toContain('["leadsPage", scopeKey, activeTab, wireSearch, page]');
    expect(PAGE).toContain('["leadBucketCounts", scopeKey, wireSearch]');
    // The two whole-population readers still exist for the consumers that genuinely want
    // every row (the funnel-leg board partitions them; features-service prices them).
    // They must not come back HERE.
    expect(PAGE).not.toContain("listBrandLeads");
    expect(PAGE).not.toContain("listCampaignLeads");
  });

  it("keys every entry on the scope, the tab, the search AND the page", () => {
    // Two windows onto one brand sharing an entry is how a reader on page 7 of Sales
    // interests is served page 1 of Contacted.
    expect(PAGE).toContain("const scopeKey = campaignId ? `campaign:${campaignId}` : `brand:${brandId}`");
  });

  it("allowlists the new roots, or the page cold-loads exactly as it did before", () => {
    // An unlisted root is default-OFF: the whole point of a small payload is that it can
    // be written to disk.
    expect(PERSIST).toContain('"leadsPage"');
    expect(PERSIST).toContain('"leadBucketCounts"');
  });

  it("pages over the TOTAL the producer states, not over the rows in memory", () => {
    expect(PAGE).toContain("const pageCount = pageCountFor(activeTotal);");
    expect(PAGE).toContain("const activeTotal = pageData?.total ?? tabCount(bucketCounts, activeTab);");
    // Counting pages over a slice of the loaded array is only correct when the array IS
    // the population — which is the thing being removed.
    expect(PAGE).not.toContain("filteredLeads.length / PAGE_SIZE");
  });

  it("labels each tab with its OWN size, and says nothing when it has not been told", () => {
    expect(PAGE).toContain("count: tabCount(bucketCounts, key),");
    expect(PAGE).toContain("{tab.count != null && (");
  });

  it("debounces the search onto the wire without debouncing the box", () => {
    expect(PAGE).toContain("const LEADS_SEARCH_DEBOUNCE_MS = 300;");
    expect(PAGE).toContain("useDebouncedValue(search, LEADS_SEARCH_DEBOUNCE_MS)");
    // The INPUT reads `search`, so typing never lags behind the keyboard.
    expect(PAGE).toContain("<EntitySearchBar\n              value={search}");
  });

  it("refuses locally what the producer would 400, and shows the reason", () => {
    expect(PAGE).toContain("const searchProblem = leadsSearchProblem(search);");
    expect(PAGE).toContain("{searchProblem && (");
  });

  it("skeletons on a tab or page CHANGE rather than showing the previous one's rows", () => {
    // The global `keepPreviousData` hands back the old key's data while the new one
    // loads; rendering it shows one tab's leads under another's heading.
    expect(PAGE).toContain("const loading = isPending || isPlaceholderData;");
  });

  it("exports by walking, bounded, and drops the per-row campaign nesting to do it", () => {
    expect(API).toContain("export async function fetchLeadsForExport(");
    expect(API).toContain("export const EXPORT_MAX_ROWS = 25000;");
    expect(API).toContain("{ includeCampaigns: false }");
    // A cursor, not the numbered pager's offset: lead-service documents the cursor as the
    // one that cannot drift while rows are being written under it.
    const at = API.indexOf("export async function fetchLeadsForExport(");
    const body = API.slice(at, API.indexOf("\n}", at));
    expect(body).toContain("cursor");
    expect(body).toContain("delete base.offset;");
  });

  it("parses the rows through the SAME reader every other leads read uses", () => {
    // A page and a full read disagreeing about a lead's shape is one bug in two places.
    expect(API).toContain('parseLeadsResponse(raw, "listLeadsPage")');
  });
});
