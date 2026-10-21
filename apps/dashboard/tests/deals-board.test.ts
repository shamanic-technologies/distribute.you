import { describe, expect, it } from "vitest";
import { DealsLifecycleSchema, dealCardChips, dealsBoardRungs, dealsLifecycleQuery, servedRungValues } from "../src/lib/deals-board";
import { uniboxCountsQuery, uniboxQuery, UniboxLifecycleCountsSchema } from "../src/lib/unibox-leads";

const LADDER = [
  { key: "meeting_booked", rank: 5, label: "Meeting booked" },
  { key: "lead_found", rank: 1, label: "Lead found" },
  { key: "contacted", rank: 2, label: "Contacted" },
  { key: "engaged", rank: 3, label: "Engaged" },
  { key: "signup_or_form", rank: 4, label: "Signed up" },
  { key: "meeting_attended", rank: 6, label: "Meeting attended" },
  { key: "paid_client", rank: 7, label: "Paid client" },
];

describe("Deals board columns = the served lifecycle ladder (owner 2026-10-21)", () => {
  it("one column per rung in rank order, Lead found dropped, labels as served", () => {
    expect(dealsBoardRungs(LADDER).map((r) => r.label)).toEqual(["Contacted", "Engaged", "Signed up", "Meeting booked", "Meeting attended", "Paid client"]);
  });
});

describe("a card's chips", () => {
  const base = { interest: "not_asked", fit: "fit", contactability: "contactable" };
  it("the default shows nothing", () => {
    expect(dealCardChips(base)).toEqual([]);
  });
  it("Interested, Not our target and Unsubscribed each show, in their served words", () => {
    expect(dealCardChips({ interest: "interested", fit: "not_our_target", contactability: "unsubscribed" }).map((t) => t.label)).toEqual([
      "Interested",
      "Not our target",
      "Unsubscribed",
    ]);
  });
  it("Unsure is not a chip", () => {
    expect(dealCardChips({ ...base, interest: "unsure" })).toEqual([]);
  });
});

describe("the reads", () => {
  it("the list and the counts carry the offer, the campaign and the filters", () => {
    expect(uniboxQuery("b", { interest: ["interested"], lifecycle: ["engaged"] }, { limit: 20, offerId: "o", campaignId: "c" })).toBe(
      "brandId=b&offerId=o&campaignId=c&lifecycle=engaged&interest=interested&limit=20",
    );
    expect(uniboxCountsQuery("b", { fit: ["wrong_person"] }, { offerId: "o" })).toBe("brandId=b&offerId=o&fit=wrong_person");
  });
  it("a read with no scope is the brand-wide read it always was", () => {
    expect(uniboxQuery("b", {}, { limit: 50 })).toBe("brandId=b&limit=50");
  });
  it("the values ask the lifecycle columns, net", () => {
    expect(dealsLifecycleQuery("b", null)).toBe("brandId=b&pricing=net&columns=lifecycle");
    expect(dealsLifecycleQuery("b", "c")).toBe("brandId=b&pricing=net&columns=lifecycle&campaignId=c");
  });
  it("parses lead-service's counts", () => {
    const body = { brandId: "b", offerId: "o", campaignId: null, lifecycleLadder: LADDER, total: 3, byLifecycle: { contacted: 2, engaged: 1, none: 0 }, builtAt: null };
    expect(UniboxLifecycleCountsSchema.parse(body).byLifecycle.contacted).toBe(2);
  });
  it("keys each served card by its relation, else its human", () => {
    const body = DealsLifecycleSchema.parse({
      offerId: "o",
      brandId: "b",
      campaignId: null,
      columns: "lifecycle",
      lifetimeRevenueUsd: 500,
      lifetimeRevenueSource: "offer_stated",
      pricedCauses: [],
      unvaluedReason: null,
      totalUsd: 60,
      expectedPipelineUsd: 60,
      wonUsd: 0,
      outOfScopeCardCount: 0,
      rungs: [
        {
          key: "engaged",
          rank: 3,
          label: "Engaged",
          valueKind: "expected_value",
          valueUsd: 60,
          expected: true,
          assumptions: [],
          cardCount: 2,
          leadCount: 2,
          organizationCount: 2,
          cards: [
            { humanId: "h1", companyKey: "k", relationKey: "rel:1", leadIds: ["l1"], valueUsd: 40, zeroValueReason: null, valueSource: null, entryRateSource: null },
            { humanId: "h2", companyKey: "k2", relationKey: null, leadIds: ["l2"], valueUsd: 20, zeroValueReason: null, valueSource: null, entryRateSource: null },
          ],
        },
      ],
    });
    const v = servedRungValues(body).get("engaged")!;
    expect(v.byRow.get("rel:1")).toBe(40);
    expect(v.byRow.get("h2")).toBe(20);
    expect(v.valueUsd).toBe(60);
  });
});

describe("People reads the same ladder as the board", () => {
  it("old bucket tab links open the rung holding those people", async () => {
    const { peopleLegacyTab } = await import("../src/lib/deals-board");
    expect(peopleLegacyTab("positive-replies")).toEqual({ rung: "engaged", filters: { interest: ["interested"] } });
    expect(peopleLegacyTab("website-visits")?.rung).toBe("engaged");
    expect(peopleLegacyTab("meetings")?.rung).toBe("meeting_booked");
    expect(peopleLegacyTab("sales")?.rung).toBe("paid_client");
    expect(peopleLegacyTab("engaged")).toBeNull();
  });
  it("the People route renders the ladder page; its tabs are the board's rungs, its rows the board's reads", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const route = readFileSync(join(__dirname, "../src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/people/page.tsx"), "utf8");
    const page = readFileSync(join(__dirname, "../src/components/v2/people-lifecycle-page.tsx"), "utf8");
    expect(route).toContain("<PeopleLifecyclePage />");
    expect(page).toContain("useDealsLifecycleCounts(brandId, null, filters)");
    expect(page).toContain("dealsBoardRungs(ladder)");
    expect(page).toContain("listUniboxLeads(brandId, { ...filters, lifecycle: [tab!.key] }");
    expect(page).not.toMatch(/rows\??\.filter\(/);
  });
});
