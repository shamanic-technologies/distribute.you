import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { hasBuyingSignal } from "../src/lib/signal-audience";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("Targeting in four steps (owner 2026-10-09)", () => {
  it("every buying-signal type is a source, never a client profile", () => {
    expect(hasBuyingSignal({ buying_signal: { type: "hiring", window_days: 30 } })).toBe(true);
    expect(hasBuyingSignal({ buying_signal: { type: "job_change", window_days: 90 } })).toBe(true);
    expect(hasBuyingSignal({ buying_signal: { type: "funding", window_days: 90 } })).toBe(true);
    expect(hasBuyingSignal({ buying_signal: { type: "linkedin_engagement", competitor_pages: [] } })).toBe(true);
    expect(hasBuyingSignal({ person_titles: ["CTO"] })).toBe(false);
    expect(hasBuyingSignal(null)).toBe(false);
    expect(hasBuyingSignal({ buying_signal: null })).toBe(false);
  });

  it("tabs read Client profiles, Sources, Qualification, Lists in that order, each with its sub", () => {
    const pages = src("src/components/v2/setup-pages.tsx");
    const fn = pages.slice(pages.indexOf("export function V2TargetingPage("), pages.indexOf("export function V2TargetingIndexPage("));
    const order = ['label: "Client profiles"', 'label: "Sources"', 'label: "Qualification"', 'label: "Lists"'].map((l) => fn.indexOf(l));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(fn).toContain("`${base}/sources`");
    expect(fn).toContain("<OfferSourcesTab ");
    expect(pages).toContain('audiences: "The people we write to."');
    expect(pages).toContain('sources: "Where we find them. Every source looks for every profile."');
    expect(pages).toContain('qualification: "What a company must pass before we write."');
    expect(pages).toContain('lists: "Who each source found, for each profile."');
    const route = src("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/offers/[offerId]/targeting/sources/page.tsx");
    expect(route).toContain('<V2TargetingPage view="sources" />');
  });

  it("Sources is read only: the Sourcing page's read and key, a StateDot, a link, no toggle or budget", () => {
    const tab = src("src/components/v2/offer-sources-tab.tsx");
    expect(tab).toContain('["offerSalesPaths", brandId, offerId, "catalogue"]');
    expect(tab).toContain("sourceCampaignsOfOffer(");
    expect(tab).toContain("<StateDot running={on}");
    expect(tab).toContain('v2OfferHref(orgId, brandId, offerId, "sourcing")');
    expect(tab).not.toMatch(/setCampaignStatus|startReactiveCampaign|saveOfferCampaignBudget|getOfferCampaignBudgets/);
  });

  it("a Sourcing row opens its campaign page", () => {
    expect(src("src/components/v2/offer-sourcing-page.tsx")).toContain("openRows");
    expect(src("src/components/v2/offer-campaigns.tsx")).toContain("(results || openRows) && mission");
  });
});
