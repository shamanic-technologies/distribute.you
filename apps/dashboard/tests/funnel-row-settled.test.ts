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
    expect(funnelRowSettled(true, { isFetchedAfterMount: false, dataUpdatedAt: before }, CREATED)).toBe(true);
  });
  it("a row missing from the cached copy waits for a read made since mount", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: false, dataUpdatedAt: after }, CREATED)).toBe(false);
  });
  it("a row missing from an answer older than the campaign still waits", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, dataUpdatedAt: before }, CREATED)).toBe(false);
  });
  it("a row missing from a fresh answer is final, and a later poll in flight never takes it back", () => {
    // 2026-10-14 Ribbon: a row features-service did not serve flashed the skeleton on every poll.
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, dataUpdatedAt: after }, CREATED)).toBe(true);
  });
});

describe("both readers of the rows gate a missing row on funnelRowSettled", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/funnel-campaigns.tsx"), "utf8");
  it("the Campaigns table passes it per row", () => {
    expect(src).toContain("rowsSettled={funnelRowSettled(rowById.has(c.id), rowsQ, c.createdAt)}");
  });
  it("the campaign page uses it for its own row", () => {
    expect(src).toContain("const rowsSettled = funnelRowSettled(row !== null, rowsQ, campaign.createdAt);");
  });
  it("sentence and Type read the fast copy read, money the full rows", () => {
    expect(src).toContain("copy={rowById.get(c.id) ?? copyById.get(c.id) ?? null}");
    expect(src).toContain("{copy?.shortDescription ? (");
    expect(src).toContain("sub={path ? <FunnelPathLine items={path.items} /> : undefined}");
  });
});
