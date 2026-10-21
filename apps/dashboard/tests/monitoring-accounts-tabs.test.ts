import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADDRESS_TABS, addressTab, backlogVerdict, bucketQueued, capacityVsPlanned, mailboxInProduction } from "../src/lib/monitoring/sending";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");

describe("Accounts page (ACCOUNTS-PROD-TABS-1021)", () => {
  it("three tabs, In production first; prod 2026-10-21 (23 / 160 / 67+2) adds up to all 252 addresses", () => {
    expect(ADDRESS_TABS.map((t) => t.label)).toEqual(["In production", "In recovery", "Deactivated"]);
    const statuses = [
      ...Array(23).fill("in_production"),
      ...Array(160).fill("in_recovery"),
      ...Array(67).fill("deactivated_by_user"),
      ...Array(2).fill("deactivated_by_instantly"),
    ];
    const count = (k: string) => statuses.filter((s) => addressTab(s) === k).length;
    expect([count("production"), count("recovery"), count("deactivated")]).toEqual([23, 160, 69]);
    expect(count("production") + count("recovery") + count("deactivated")).toBe(statuses.length);
    // a value no tab names still counts somewhere, so the tabs always add up
    expect(addressTab("paused_new_state")).toBe("other");
    expect(addressTab(null)).toBe("other");
  });

  it("a production mailbox is still there and holds an in-production address (45 rows had one, 22 of them gone)", () => {
    expect(mailboxInProduction({ absentSince: null, addresses: [{ lifecycleStatus: "in_recovery" }, { lifecycleStatus: "in_production" }] })).toBe(true);
    expect(mailboxInProduction({ absentSince: "2026-10-20", addresses: [{ lifecycleStatus: "in_production" }] })).toBe(false);
    expect(mailboxInProduction({ absentSince: null, addresses: [{ lifecycleStatus: "deactivated_by_user" }] })).toBe(false);
  });

  it("queued buckets over prod's 23 production mailboxes: count and share per bucket", () => {
    const prod = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 4, 5, 8, 53, 69, 104, 141, 177];
    const b = bucketQueued(prod);
    expect(b.map((x) => [x.label, x.count])).toEqual([
      ["0", 11],
      ["1-50", 7],
      ["51-100", 2],
      ["101-200", 3],
      ["200+", 0],
    ]);
    expect(b.reduce((t, x) => t + x.count, 0)).toBe(prod.length);
    expect(Math.round(b[0].pct)).toBe(48);
    expect(bucketQueued([50, 51, 100, 101, 200, 201]).map((x) => x.count)).toEqual([0, 1, 2, 2, 1]);
    expect(bucketQueued([]).every((x) => x.pct === 0)).toBe(true);
  });

  it("capacity vs planned: cumulated from today, planned starts with the overdue steps, past capacity ignored", () => {
    const cap = [
      { date: "2026-10-20", phase: "past", capacity: 999 },
      { date: "2026-10-21", phase: "today", capacity: 681 },
      { date: "2026-10-22", phase: "future", capacity: 915 },
      { date: "2026-10-23", phase: "future", capacity: 1146 },
    ];
    const plan = [
      { date: "2026-10-21", queuedSteps: 83 },
      { date: "2026-10-22", queuedSteps: 474 },
      { date: "2026-10-23", queuedSteps: 265 },
    ];
    const days = capacityVsPlanned(cap, plan, 1167);
    expect(days).toEqual([
      { date: "2026-10-21", capacity: 681, planned: 83, cumulativeCapacity: 681, cumulativePlanned: 1250 },
      { date: "2026-10-22", capacity: 915, planned: 474, cumulativeCapacity: 1596, cumulativePlanned: 1724 },
      { date: "2026-10-23", capacity: 1146, planned: 265, cumulativeCapacity: 2742, cumulativePlanned: 1989 },
    ]);
    expect(backlogVerdict(days)).toEqual({ kind: "absorbed", date: "2026-10-23" });
    expect(backlogVerdict(capacityVsPlanned(cap, plan, 0))).toEqual({ kind: "covered" });
    expect(backlogVerdict(capacityVsPlanned(cap, plan, 9999))).toEqual({ kind: "overflow", date: "2026-10-23" });
    expect(backlogVerdict(capacityVsPlanned(cap, plan.map((p) => ({ ...p, queuedSteps: 0 })), 0))).toBeNull();
    // a day the capacity read does not cover: unknown, never zero
    const gap = capacityVsPlanned(cap.slice(0, 2), plan, 0);
    expect(gap[1].capacity).toBeNull();
    expect(gap[1].cumulativeCapacity).toBeNull();
    expect(backlogVerdict(gap)).toBeNull();
  });

  it("the page wires it: tabs over the table, charts in the right third, the cumulated chart on every entity page", () => {
    const sending = read("components/v2/monitoring-sending.tsx");
    expect(sending).toContain('useState<AddressTabKey>("production")');
    expect(sending).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    expect(sending).toContain("<QueuedBuckets />");
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('<CapacityPlanChart scope={{}} lifecycle="in_production" />');
    const drill = read("components/v2/monitoring-drilldown.tsx");
    expect(drill).toContain("<CapacityPlanChart scope={scope} />");
  });
});
