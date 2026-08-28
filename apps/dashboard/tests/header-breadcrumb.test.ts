import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const src = read("src/components/header-page-context.tsx");

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

  // A campaign lives at `.../offers/:id/campaigns/:id` — OFF the funnel it was
  // opened from — so a crumb gated on the path segment vanished exactly one level
  // deeper than the list the campaign was picked in: the bar read
  // `Offer / <leg> Via <channel>` and never named the funnel the leg belongs to.
  // The campaign states its own funnel, in the SAME wire vocabulary the funnels
  // route carries, so the crumb reads the same words and links to the same page
  // whichever way you arrived.
  it("names the funnel on a campaign page, off the campaign's own key", () => {
    expect(src).toContain("route.funnelKey ?? campaign?.funnelKey ?? null");
    // The gate is the RESOLVED key, never the path segment — that distinction is
    // the whole fix.
    expect(src).toContain("{funnelKey !== null && (");
    expect(src).not.toContain("{route.funnelKey !== null && (");
    expect(src).toContain("funnels/${encodeURIComponent(funnelKey");
  });

  // Every tile in the bar is the SAME size, and it holds by construction.
  // `OfferMark`'s "sm" is 18px while the funnel and channel marks' "sm" is a
  // 32px table tile, so passing "sm" to both drew an 18px offer beside two
  // 32px campaign marks on one line — reported as the two crumbs reading as
  // different styles. The campaign half now asks for "xs", which those two
  // marks define as the same 18px `rounded` tile the offer wears.
  it("draws the offer and the campaign at one tile size", () => {
    expect(src).toContain('<OfferMark size="sm" />');
    // The campaign crumb no longer carries a size: it renders the shared inline
    // identity, which pins both of its marks to `xs` itself — one place decides
    // the tile, so the crumbs line up by construction rather than by a prop a
    // call site can get wrong.
    const identity = read("src/components/campaigns/campaign-identity.tsx");
    const inline = identity.slice(identity.indexOf("export function CampaignIdentityInline("));
    expect((inline.match(/size="xs"/g) ?? []).length).toBe(2);

    const offer = read("src/components/marks/offer-mark.tsx");
    expect(offer).toContain('size === "sm" ? "h-[18px] w-[18px]"');

    for (const rel of [
      "src/components/marks/sales-funnel-mark.tsx",
      "src/components/marks/acquisition-channel-mark.tsx",
    ]) {
      const mark = read(rel);
      expect(mark).toContain('type MarkSize = "xs" | "sm" | "md";');
      expect(mark).toContain('xs: "h-[18px] w-[18px] rounded"');
      expect(mark).toContain("xs: 12");
    }
  });
});
/**
 * A leg page is ONE ARROW of a funnel, and it is the deepest thing a path names.
 * The bar stopped at the funnel there, so two different legs of one funnel wore
 * the same crumb and the page said nothing about which arrow you had opened.
 */
describe("the leg crumb", () => {
  it("parses `funnels/:key/legs/:legKey` in the same one parser", () => {
    expect(src).toContain("legKey: string | null;");
    expect(src).toContain('sixth === "legs"');
    // Only under a funnel: a `legs` segment anywhere else names no arrow of
    // anything, and a crumb for it would be a word with no funnel behind it.
    expect(src).toContain("funnelKey !== null && sixth === \"legs\"");
    expect(src).toContain("decodeURIComponent(seventh)");
  });

  it("names the arrow in the funnel's OWN words, off the shared walk", () => {
    // The same list the funnel page lists its rows from and the same words a
    // campaign is named with, so an arrow reads identically whether you opened
    // it as a leg or as the campaign that performs it.
    expect(src).toContain('from "@/lib/campaign-leg"');
    expect(src).toContain("funnelLegs(funnelDef).find((l) => l.toKey === route.legKey)");
    expect(src).toContain("<FunnelLegMark fromKey={leg.fromKey} toKey={leg.toKey} size=\"xs\" />");
    expect(src).toContain("{leg.label}");
  });

  it("renders NOTHING for a key naming no arrow of this funnel", () => {
    // Same rule as the funnel crumb for a key the catalogue does not carry: a
    // guessed crumb is worse than none.
    expect(src).toContain("{leg !== null && (");
    expect(src).toContain("?? null)");
  });

  it("is where you already are, so it is never a link", () => {
    const marker = "{leg !== null && (";
    const at = src.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    // 547 chars — measured to the block's closing brace, not padded: this is a
    // `not.toContain`, so a slice that ran past it would reach the campaign
    // crumb, which legitimately renders a <Link>.
    const block = src.slice(at, at + 547);
    expect(block).toContain('aria-current="page"');
    expect(block).not.toContain("<Link");
  });

  it("stops treating the offer as the current page on a leg route", () => {
    expect(src).toContain("route.funnelKey === null && route.legKey === null");
  });
});
