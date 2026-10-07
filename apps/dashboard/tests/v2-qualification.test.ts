import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  criterionStatusWord,
  formatCostPerLead,
  formatPassRate,
  sortCriteria,
} from "../src/lib/v2/qualification";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("qualification formatting", () => {
  it("keeps a sub-cent cost per lead readable", () => {
    expect(formatCostPerLead(0.0042)).toBe("$0.0042");
    expect(formatCostPerLead(0.00418)).toBe("$0.0042");
    expect(formatCostPerLead(0.012)).toBe("$0.01");
    expect(formatCostPerLead(0.25)).toBe("$0.25");
    expect(formatCostPerLead(0)).toBe("$0");
    expect(() => formatCostPerLead(Number.NaN)).toThrow();
  });

  it("prints the served pass rate, null when nobody was checked", () => {
    expect(formatPassRate(0.624)).toBe("62%");
    expect(formatPassRate(0)).toBe("0%");
    expect(formatPassRate(null)).toBeNull();
  });

  it("names a never-enabled AI pick Suggested", () => {
    expect(criterionStatusWord({ enabled: true, origin: "suggested" })).toBe("On");
    expect(criterionStatusWord({ enabled: false, origin: "suggested" })).toBe("Suggested");
    expect(criterionStatusWord({ enabled: false, origin: "custom" })).toBe("Off");
  });

  it("lists checks that are on first, keeping the served order", () => {
    const rows = [
      { id: "a", enabled: false },
      { id: "b", enabled: true },
      { id: "c", enabled: false },
      { id: "d", enabled: true },
    ];
    expect(sortCriteria(rows).map((r) => r.id)).toEqual(["b", "d", "a", "c"]);
  });
});

describe("qualification surfaces", () => {
  it("Targeting carries an Audiences and a Qualification tab", () => {
    const pages = src("src/components/v2/setup-pages.tsx");
    expect(pages).toContain('label: "Audiences"');
    expect(pages).toContain('label: "Qualification"');
    expect(pages).toContain("<OfferQualification ");
  });

  it("the table renders served cost per lead and pass rate, never a browser computation", () => {
    const table = src("src/components/v2/offer-qualification.tsx");
    expect(table).toContain("formatCostPerLead(c.estimate.perRowUsd)");
    expect(table).toContain("formatPassRate(c.passRate.passRate)");
    expect(table).not.toMatch(/passRate\.yes\s*\//);
  });

  it("roles read Hard filter / Bonus, and Cost per lead says it is an estimate", () => {
    const words = src("src/lib/v2/qualification.ts");
    expect(words).toContain('must_pass: "Hard filter"');
    expect(words).toContain('mention: "Bonus"');
    expect(words).not.toContain("Mention in email");
    const table = src("src/components/v2/offer-qualification.tsx");
    expect(table).toContain("<ExpectedLabel tip={COST_PER_LEAD_TIP}>Cost per lead</ExpectedLabel>");
  });

  it("checks are managed through the AI chat, scoped to the offer, refreshing the list", () => {
    const table = src("src/components/v2/offer-qualification.tsx");
    expect(table).toContain("configKey={QUALIFICATION_CHAT_KEY}");
    expect(table).toContain("context={{ offerId }}");
    expect(table).toContain("invalidateKeys={[[...criteriaKey(brandId, offerId)]]}");
    expect(table).not.toContain("suggestOfferQualificationCriteria");
  });

  it("the person page reads the checks by the PERSON id, on the selected offer", () => {
    const person = src("src/components/v2/person-page.tsx");
    expect(person).toContain("<LeadChecks ");
    expect(person).toContain("leadId={lead.leadId}");
    const checks = src("src/components/v2/lead-checks.tsx");
    expect(checks).toContain("getLeadQualification(leadId, brandId, offerId)");
  });
});
