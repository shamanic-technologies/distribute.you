import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEAD_FAMILIES, familyFilter, familyLook, isLeadFamily } from "../src/lib/lead-families";
import { PeopleListSchema } from "../src/lib/people-conversations";

describe("Unibox lead families (owner 2026-10-08)", () => {
  it("lists Hot first, then Won, Lost, Cold, with the owner's labels", () => {
    expect(LEAD_FAMILIES.map((f) => f.label)).toEqual(["Hot leads", "Won clients", "Lost leads", "Cold leads"]);
  });
  it("opens on All, keeps an explicit pick", () => {
    expect(familyFilter(null)).toBe("all");
    expect(familyFilter("hot")).toBe("hot");
    expect(familyFilter("won")).toBe("won");
    expect(familyFilter("all")).toBe("all");
    expect(familyFilter("bogus")).toBe("all");
    expect(isLeadFamily("cold")).toBe(true);
    expect(isLeadFamily("in_conversation")).toBe(false);
  });
  it("colours a person by family; a person with none keeps the plain tag", () => {
    expect(familyLook("hot")).toEqual({ tone: "hot", icon: "flame" });
    expect(familyLook("won")).toEqual({ tone: "won", icon: "check" });
    expect(familyLook("lost")?.tone).toBe("lost");
    expect(familyLook(null)).toBeNull();
  });
  it("parses crm-service's family fields and keeps a list without them", () => {
    const base = {
      brandId: "b",
      scope: { status: "ready", lastBuiltAt: null, lastError: null },
      sources: [],
      total: 0,
      limit: 100,
      offset: 0,
      nextOffset: null,
      people: [],
    };
    expect(PeopleListSchema.safeParse(base).success).toBe(true);
    const withFamilies = PeopleListSchema.parse({
      ...base,
      families: { status: "ok", error: null, filter: "hot", counts: { won: 1, hot: "13", lost: 22, cold: 0 } },
    });
    expect(withFamilies.families?.counts.hot).toBe(13);
  });
});

describe("Unibox family buttons are wired (owner 2026-10-08)", () => {
  const src = readFileSync(new URL("../src/components/v2/integrations-conversations.tsx", import.meta.url), "utf8");
  it("asks crm-service for one family and puts the buttons beside the search", () => {
    expect(src).toContain('family: f === "all" ? undefined : f');
    expect(src).toContain('queryKey: ["people", brandId, "scroll", q, f]');
    expect(src).toContain("...listQuery(family),");
    expect(src).toContain("right={<FamilyButtons value={family} families={families} onPick={pickFamily} />}");
    // The tag takes its own fact's colour, not the family's (owner 2026-10-10, unibox-standing-colours.test.ts).
    expect(src).toContain("{status && <PersonTag label={status} state={person.state} />}");
  });
  it("every other family's first page loads with the page, so a button answers from memory", () => {
    expect(src).toContain("prefetchInfiniteQuery({ ...listQuery(f), staleTime: POLL_INTERVAL })");
  });
  it("sends the family to the gateway", () => {
    const api = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
    expect(api).toContain('if (opts.family) qs.set("family", opts.family);');
  });
});
