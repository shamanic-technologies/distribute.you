import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { funnelRowSettled } from "../src/lib/sales-funnel-campaigns";

// 2026-10-13 Doc Dinners: the Campaigns table painted a 3-row cached copy saved before 6 newer
// campaigns existed, and printed "—" for their path, type and money while the fresh read was on its way.
describe("funnelRowSettled", () => {
  it("a served row is final, even from the cached copy", () => {
    expect(funnelRowSettled(true, { isFetchedAfterMount: false, isFetching: true })).toBe(true);
  });
  it("a row missing from the cached copy waits for a read made since mount", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: false, isFetching: true })).toBe(false);
    expect(funnelRowSettled(false, { isFetchedAfterMount: false, isFetching: false })).toBe(false);
  });
  it("a row missing while a re-read is in flight still waits", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, isFetching: true })).toBe(false);
  });
  it("a row missing from a fresh answer is final", () => {
    expect(funnelRowSettled(false, { isFetchedAfterMount: true, isFetching: false })).toBe(true);
  });
});

describe("both readers of the rows gate a missing row on funnelRowSettled", () => {
  const src = readFileSync(join(__dirname, "../src/components/v2/funnel-campaigns.tsx"), "utf8");
  it("the Campaigns table passes it per row", () => {
    expect(src).toContain("rowsSettled={funnelRowSettled(rowById.has(c.id), rowsQ)}");
  });
  it("the campaign page uses it for its own row", () => {
    expect(src).toContain("const rowsSettled = funnelRowSettled(row !== null, rowsQ);");
  });
  it("path and Type read the fast copy read, money the full rows", () => {
    expect(src).toContain("copy={rowById.get(c.id) ?? copyById.get(c.id) ?? null}");
    expect(src).toContain("{copy?.path ? <FunnelPathLine items={copy.path.items} />");
    expect(src).toContain("sub={path ? <FunnelPathLine items={path.items} /> : undefined}");
  });
});
