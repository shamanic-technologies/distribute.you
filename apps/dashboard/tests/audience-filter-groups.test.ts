import { describe, expect, it } from "vitest";
import { audienceFilterGroups } from "../src/lib/audience-filter-groups";

// human-service "one filter vocabulary" Wave 2 stores apollo audiences' filters
// under Apollo's FAITHFUL native field names. The category map must recognize
// those so faithful audiences render the same clean grouped pills as the legacy
// neutral-named ones. These assert each Apollo key resolves to its category
// label (not a raw humanized key / NEUTRAL ungrouped pill).
describe("audienceFilterGroups — faithful Apollo field names", () => {
  const labelFor = (key: string, value: unknown): string | undefined =>
    audienceFilterGroups({ [key]: value }).at(0)?.label;

  it("maps Apollo industry/seniority/employee keys to their categories", () => {
    expect(labelFor("qOrganizationIndustryTagIds", ["saas"])).toBe("Industry");
    expect(labelFor("personSeniorities", ["vp"])).toBe("Seniority");
    expect(labelFor("organizationNumEmployeesRanges", ["11,50"])).toBe("Employee range");
  });

  it("maps Apollo location keys to Location", () => {
    expect(labelFor("personLocations", ["United States"])).toBe("Location");
    expect(labelFor("organizationLocations", ["California"])).toBe("Location");
  });

  it("maps Apollo technology + keyword keys to their categories", () => {
    expect(labelFor("currentlyUsingAnyOfTechnologyUids", ["stripe"])).toBe("Technology");
    expect(labelFor("qKeywords", ["fintech"])).toBe("Keywords");
    expect(labelFor("qOrganizationKeywordTags", ["payments"])).toBe("Keywords");
  });

  it("keeps already-supported faithful keys (personTitles, revenueRange) on their groups", () => {
    expect(labelFor("personTitles", ["Founder"])).toBe("Job titles");
    expect(labelFor("revenueRange", { min: 1000000 })).toBeUndefined(); // object value → no scalar pill
    expect(labelFor("revenueRange", "1M-10M")).toBe("Revenue");
  });

  it("still groups legacy neutral keys (additive change, no removals)", () => {
    expect(labelFor("industries", ["saas"])).toBe("Industry");
    expect(labelFor("seniorities", ["vp"])).toBe("Seniority");
    expect(labelFor("technologies", ["stripe"])).toBe("Technology");
    expect(labelFor("keywords", ["fintech"])).toBe("Keywords");
  });
});
