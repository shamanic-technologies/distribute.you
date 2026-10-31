import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { funnelRowSettled } from "../src/lib/sales-funnel-campaigns";

// 2026-10-13 Doc Dinners: the Campaigns table painted a 3-row cached copy saved before 6 newer
// campaigns existed, and printed "—" for their path, type and money while the fresh read was on its way.
const CREATED = "2026-10-14T11:38:21.815Z";
const before = Date.parse(CREATED) - 60_000;
const after = Date.parse(CREATED) + 60_000;

describe("funnelRowSettled", () => {
  it("a served row is final, even from the cached copy", () => {
    expect(funnelRowSettled(true, { isFetchedAfterMount: false, dataUpdatedAt: before, isError: false }, CREATED)).toBe(true);
  });
  it("a row missing from the cached copy waits for a read made since mount", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: false, dataUpdatedAt: after, isError: false }, CREATED)).toBe(false);
  });
  it("a row missing from an answer older than the campaign still waits", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, dataUpdatedAt: before, isError: false }, CREATED)).toBe(false);
  });
  it("a row missing from a fresh answer is final, and a later poll in flight never takes it back", () => {
    // 2026-10-14 Ribbon: a row features-service did not serve flashed the skeleton on every poll.
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, dataUpdatedAt: after, isError: false }, CREATED)).toBe(true);
  });
  it("a read since mount that failed is final: '—', never a skeleton forever (2026-10-16)", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, dataUpdatedAt: 0, isError: true }, CREATED)).toBe(true);
  });
  it("a failure restored before mount does not settle a missing row", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: false, dataUpdatedAt: 0, isError: true }, CREATED)).toBe(false);
  });
});

describe("the Campaigns list states a failed money read", () => {
  const list = readFileSync(join(__dirname, "../src/components/v2/campaigns-overview-page.tsx"), "utf8");
  it("logs the rows error by name instead of blaming a missing row", () => {
    expect(list).toContain("rowsError={rowsQ.isError && !rowById.has(c.id) ? rowsQ.error : null}");
    expect(list).toContain('console.error("[funnel-campaigns] money read failed"');
  });
});

describe("both readers of the rows gate a missing row on funnelRowSettled", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/funnel-campaigns.tsx"), "utf8");
  const list = readFileSync(join(__dirname, "../src/components/v2/campaigns-overview-page.tsx"), "utf8");
  it("the Campaigns list passes it per row", () => {
    expect(list).toContain("rowSettled={funnelRowSettled(rowById.has(c.id), rowsQ, c.createdAt)}");
  });
  it("the campaign page uses it for its own row", () => {
    expect(src).toContain("const rowsSettled = funnelRowSettled(row !== null, rowsQ, campaign.createdAt);");
  });
  it("path and Type read the fast copy read, money the full rows", () => {
    expect(list).toContain("copy={rowById.get(c.id) ?? copyById.get(c.id) ?? null}");
    expect(list).toContain("{copy?.path ? (");
    // P5.1: the page's path moved from the header into "What this campaign aims at", on the same copy.
    expect(src).toContain("const copyOf = row ?? copyRow;");
    expect(src).toContain("<CampaignAimSection campaign={campaign} copy={copyOf}");
    expect(src).not.toContain("sub={path ? <FunnelPathLine");
  });
});
