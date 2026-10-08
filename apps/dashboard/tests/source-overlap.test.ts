import { describe, expect, it } from "vitest";
import { bucketLabel, orderedBuckets, sourceLeadRows } from "../src/lib/source-overlap";

describe("source overlap (a lead carries every source that found it)", () => {
  it("lists live sources, most leads first, an unread count last", () => {
    const s = (key: string, leads: number | null | undefined, also: number | null, live = true) => ({
      campaignKey: key, channelName: key, campaignName: null, provider: null, live,
      leadsFound: leads, leadsAlsoFoundByAnotherSource: also,
    });
    const rows = sourceLeadRows([s("a", 10, 2), s("b", null, null), s("c", 40, 2), s("old", 99, 0, false)]);
    expect(rows.map((r) => r.key)).toEqual(["c", "a", "b"]);
    expect(rows[0]).toMatchObject({ leads: 40, alsoFoundByAnother: 2 });
    expect(rows[2]).toMatchObject({ leads: null, alsoFoundByAnother: null });
  });

  it("orders 1, 2, 3+ then no-source, dropping an empty no-source row", () => {
    const b = (sourceCount: number, leads: number) => ({ sourceCount, leads });
    expect(orderedBuckets([b(0, 5), b(3, 1), b(1, 100), b(2, 8)]).map((x) => x.sourceCount)).toEqual([1, 2, 3, 0]);
    expect(orderedBuckets([b(0, 0), b(1, 3)]).map((x) => x.sourceCount)).toEqual([1]);
  });

  it("labels buckets in plain words", () => {
    expect([0, 1, 2, 3].map(bucketLabel)).toEqual(["No source found", "1 source", "2 sources", "3+ sources"]);
  });
});
