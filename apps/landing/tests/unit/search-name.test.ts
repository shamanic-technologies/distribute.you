import { describe, it, expect } from "vitest";
import { searchName } from "../../src/lib/agencies";
import { CS_AGENCIES } from "../../src/lib/customer-success-agencies";
import { renderCsVsPage } from "../../src/lib/pages/customer-success-agency-compare";

// SEO-TITLES-1108: Google showed our South page for "hireinsouth.com alternatives" at
// position 8 with no click, while its title only said "South".
describe("searchName", () => {
  it("adds the domain only when people can know the provider by it", () => {
    expect(searchName({ name: "South", domain: "hireinsouth.com" })).toBe("South (hireinsouth.com)");
    expect(searchName({ name: "Callbox", domain: "callboxinc.com" })).toBe("Callbox (callboxinc.com)");
    expect(searchName({ name: "Belkins", domain: "belkins.io" })).toBe("Belkins");
    expect(searchName({ name: "VA Masters", domain: "vamasters.com" })).toBe("VA Masters");
  });

  it("puts it in the vs page title", () => {
    const south = CS_AGENCIES.find((a) => a.slug === "south");
    expect(south).toBeDefined();
    expect(renderCsVsPage(south!)).toContain("<title>distribute.you vs South (hireinsouth.com):");
  });
});
