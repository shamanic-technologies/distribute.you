import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");

describe("Revenue Steps tab (owner 2026-10-07: Legs and Steps moved off Outbound onto the offer page)", () => {
  const setup = read("src/components/v2/setup-pages.tsx");
  const outbound = read("src/components/v2/offer-sales-path-page.tsx");
  const tab = read("src/components/v2/offer-revenue-steps.tsx");

  it("the offer page has Overview and Revenue Steps tabs", () => {
    expect(setup).toContain('{ label: "Overview", href: base, active: view === "overview" }');
    expect(setup).toContain('label: "Revenue Steps", href: v2OfferHref(orgId, brandId, offerId, "revenue-steps")');
    expect(setup).toContain("<OfferRevenueSteps brandId={brandId} offerId={offerId} />");
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/offers/[offerId]/revenue-steps/page.tsx")).toContain('<V2OfferPage view="revenue-steps" />');
  });

  it("the tab mounts the legs and steps and saves them, then re-reads the paths", () => {
    expect(tab).toContain("<OfferSalesPath");
    expect(tab).toContain("saveOfferSalesPath(brandId, offerId, [...next.steps], salesPathLegsWire(next.legs, offered.channelsByLeg, offered.legs))");
    // Readers take the legs with their channel, never the deprecated bare list.
    expect(tab).toContain("legKeysOfStored(q.data.legs)");
    expect(tab).not.toContain("legKeys ??");
    expect(tab).toContain('queryKey: ["offerSalesPaths", brandId, offerId]');
  });

  it("the Outbound page no longer mounts the legs and steps", () => {
    expect(outbound).not.toContain("<OfferSalesPath\n");
    expect(outbound).not.toContain("saveOfferSalesPath(");
    expect(outbound).not.toContain("legsFirst");
  });
});
