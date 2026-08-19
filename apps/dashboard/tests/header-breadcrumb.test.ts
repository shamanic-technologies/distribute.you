import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(
  join(process.cwd(), "src/components/header-page-context.tsx"),
  "utf8",
);

describe("the top bar names where you are below the tenant", () => {
  // Org and brand stay in the sidebar switcher: they are what does NOT change
  // as you move around, and restating them here would duplicate the switcher.
  // What changes is the proposition and the campaign of it.
  it("carries the offer and the campaign, never the org or the brand", () => {
    expect(src).toContain("OfferMark");
    expect(src).toContain("<CampaignTitle");
    expect(src).not.toContain("OrgAvatar");
    expect(src).not.toContain("BrandLogo");
  });

  // The parser lives in ONE place with a test on it. The previous version
  // hardcoded the campaign at path segment 4 inside the component and broke
  // silently the day campaigns moved under the offer — the bar rendered
  // nothing on every campaign page and nothing went red.
  it("parses the path in one named function, not inline indices", () => {
    expect(src).toContain("export function offerRouteFromPath");
    const marker = "export function offerRouteFromPath";
    const after = src.slice(src.indexOf(marker) + marker.length);
    const component = after.slice(after.indexOf("export function HeaderPageContext"));
    expect(component).not.toContain("split(\"/\")");
  });

  // A breadcrumb's last item is where you already are.
  it("links the offer only when it is not the current page", () => {
    expect(src).toContain("offerIsCurrent");
    expect(src).toContain('aria-current="page"');
  });

  // Both keys are byte-equal to the ones the pages below already poll, so the
  // bar costs no extra request.
  it("shares its queries with the pages under it", () => {
    expect(src).toContain('["campaign", route?.campaignId ?? "none"]');
    expect(src).toContain('["brandOffer", route?.brandId ?? "none", route?.offerId ?? "none"]');
  });

  // A placeholder word would state a name we do not have yet.
  it("skeletons an unresolved label rather than naming it", () => {
    expect(src).toContain("CrumbSkeleton");
    expect(src).not.toContain('|| "Offer"');
    expect(src).not.toContain('|| "Campaign"');
  });
});
