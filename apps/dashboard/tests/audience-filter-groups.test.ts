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
    expect(labelFor("q_organization_industry_tag_ids", ["saas"])).toBe("Industry");
    expect(labelFor("person_seniorities", ["vp"])).toBe("Seniority");
    expect(labelFor("organization_num_employees_ranges", ["1,200"])).toBe("Employee range");
  });

  it("maps Apollo location keys to Location", () => {
    expect(labelFor("personLocations", ["United States"])).toBe("Location");
    expect(labelFor("organizationLocations", ["California"])).toBe("Location");
  });

  it("maps Apollo technology + keyword keys to their categories", () => {
    expect(labelFor("currentlyUsingAnyOfTechnologyUids", ["stripe"])).toBe("Technology");
    expect(labelFor("qKeywords", ["fintech"])).toBe("Keywords");
    expect(labelFor("q_keywords", ["fintech"])).toBe("Search terms");
    expect(labelFor("qOrganizationKeywordTags", ["payments"])).toBe("Keywords");
  });

  it("formats Apollo values for the detail panel — and hides only contact_email_status", () => {
    const groups = audienceFilterGroups({
      q_keywords: "marketing agency OR advertising agency",
      person_seniorities: ["owner", "founder", "c_suite"],
      organization_num_employees_ranges: ["1,200"],
      contact_email_status: ["verified"], // internal deliverability flag — hidden
    });

    expect(groups).toEqual([
      {
        label: "Search terms",
        tone: "bg-lime-50 text-lime-700 border-lime-200",
        values: ["marketing agency OR advertising agency"],
      },
      {
        label: "Seniority",
        tone: "bg-purple-50 text-purple-700 border-purple-200",
        values: ["Owner", "Founder", "C-suite"],
      },
      {
        label: "Employee range",
        tone: "bg-sky-50 text-sky-700 border-sky-200",
        values: ["1-200 employees"],
      },
    ]);
  });

  it("renders range objects ({min,max}) instead of dropping them", () => {
    expect(labelFor("personTitles", ["Founder"])).toBe("Job titles");
    // revenue_range / revenueRange object → Revenue group, formatted currency range.
    const rev = audienceFilterGroups({ revenue_range: { min: 10000000, max: 50000000 } }).at(0);
    expect(rev?.label).toBe("Revenue");
    expect(rev?.values).toEqual(["$10M-$50M"]);
    // hiring signal → Open roles group.
    const jobs = audienceFilterGroups({ organization_num_jobs_range: { min: 5 } }).at(0);
    expect(jobs?.label).toBe("Open roles");
    expect(jobs?.values).toEqual(["5+ open roles"]);
    // scalar revenue string still works.
    expect(labelFor("revenueRange", "1M-10M")).toBe("Revenue");
  });

  it("still groups legacy neutral keys (additive change, no removals)", () => {
    expect(labelFor("industries", ["saas"])).toBe("Industry");
    expect(labelFor("seniorities", ["vp"])).toBe("Seniority");
    expect(labelFor("technologies", ["stripe"])).toBe("Technology");
    expect(labelFor("keywords", ["fintech"])).toBe("Keywords");
  });
});
