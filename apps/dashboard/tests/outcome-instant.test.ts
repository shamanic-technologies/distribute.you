import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// OUTCOME-INSTANT-1108 (owner 2026-11-08 « Affichage trop lent, tu peux le rendre instant? », Lead found page).
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("outcome pages open instantly", () => {
  const audience = read("src/components/v2/audience-page.tsx");
  const leadsFound = audience.slice(audience.indexOf("export function LeadsFoundPeople("), audience.indexOf("function OfferAudienceLines("));

  it("Lead found counts Everyone from the people list's own total, never the slow audience snapshot", () => {
    expect(leadsFound).not.toContain("useAudienceSnapshot(");
    expect(leadsFound).toContain("heldPeopleKey(brandId, staff, 0, false)");
    expect(leadsFound).toContain("firstPage.data?.total");
  });

  it("the page and the hover warm-up read the SAME keys (one builder each)", () => {
    expect(audience).toContain("useAuthQuery(heldPeopleKey(brandId, staff, offset, acceptedOnly)");
    expect(audience).toContain("useAuthQuery(brandOffersKey(brandId)");
    expect(read("src/components/v2/outcomes-page.tsx")).toContain("useAuthQuery(outcomePeopleKey(brandId, crmStep, contactedOnly, offset)");
  });

  it("$ invested readers return a plain object (persisted as JSON: a Map comes back from disk as {})", () => {
    const api = read("src/lib/api.ts");
    const people = api.slice(api.indexOf("export async function getSourcingPeople("), api.indexOf("export async function getSourcingCompanies("));
    const companies = api.slice(api.indexOf("export async function getSourcingCompanies("));
    expect(people).toContain("Promise<Record<string, InvestedMoney>>");
    expect(companies.slice(0, companies.indexOf("\n}\n"))).toContain("Promise<Record<string, InvestedMoney>>");
    expect(audience).not.toContain("cost.data?.get(");
  });

  it("the sidebar outcome entries and the Overview rows warm the outcome on hover and focus", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    expect(shell).toContain("onMouseEnter={onWarm}");
    expect(shell).toContain("onWarm={() => warmOutcome(outcome)}");
    expect(read("src/components/v2/outcomes-page.tsx")).toContain("onMouseEnter={() => warm(o.outcome)}");
  });
});
