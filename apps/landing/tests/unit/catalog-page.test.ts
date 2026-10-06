import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  catalogGroup,
  catalogSections,
  formatPrice,
  parsePlatformPrices,
  renderCatalogPage,
  type PlatformPrice,
} from "../../src/lib/pages/catalog";

/**
 * `/catalog` (owner 2026-10-06): why we bill per tool rather than per email, and the
 * live unit price of every tool behind an email, read from the public cost catalogue.
 */
const row = (p: Partial<PlatformPrice>): PlatformPrice => ({
  name: "x",
  pricePerUnitInUsdCents: "1",
  provider: "instantly",
  providerDomain: "instantly.ai",
  type: "Email send",
  unit: "email",
  pricingBasis: "marked-up",
  status: "current",
  lastUsedOn: "2026-10-05",
  usageReadAt: "2026-10-06T08:47:04.668Z",
  bundle: null,
  ...p,
});

const FIXTURE: PlatformPrice[] = [
  row({ name: "anthropic-sonnet-5.5-tokens-input", provider: "anthropic", type: "Input tokens (Sonnet 5.5)", unit: "1M tokens", pricePerUnitInUsdCents: "0.0004000000" }),
  row({ name: "instantly-email-send", type: "Email send (per account)", pricePerUnitInUsdCents: "2.9886000000" }),
  row({ name: "instantly-domain-email-sent", type: "Email send (per account)", pricePerUnitInUsdCents: "2.9886000000" }),
  row({ name: "apollo-search-credit", provider: "apollo", type: "Credit", unit: "credit", pricePerUnitInUsdCents: "0" }),
  row({ name: "cloudflare-r2-class-b-operation", provider: "cloudflare", type: "R2 Class B operation", unit: "operation", pricePerUnitInUsdCents: "0.0000720000" }),
  row({ name: "meta-ads-spend", provider: "meta-ads", type: "Meta Ads platform spend", unit: "USD cent", pricingBasis: "pass-through" }),
  row({ name: "x-post-create", provider: "x", type: "X API v2 post create", unit: "post" }),
  row({ name: "a-current-search-query", provider: "google", type: "Search query (grounding)", unit: "query", pricePerUnitInUsdCents: "2.8" }),
];

describe("catalog price list", () => {
  it("restates token rows per million tokens and other rows per unit", () => {
    expect(formatPrice(FIXTURE[0])).toBe("$4.00 / 1M tokens");
    expect(formatPrice(FIXTURE[1])).toBe("$0.0299 / email");
    expect(formatPrice(FIXTURE[3])).toBe("Free");
    expect(formatPrice(FIXTURE[4])).toBe("$0.000000720 / operation");
  });

  it("keeps media spend, payment fees and channels we do not sell off the page", () => {
    expect(catalogGroup(FIXTURE[5])).toBeNull();
    expect(catalogGroup(FIXTURE[6])).toBeNull();
    expect(catalogGroup(FIXTURE[7])).toBe("research");
  });

  it("a retired tool is not listed as one we run (the single-line Instantly send)", () => {
    expect(catalogGroup(row({ name: "instantly-email-send", pricePerUnitInUsdCents: "5.9772", status: "retired" }))).toBeNull();
    expect(catalogGroup(row({ name: "instantly-account-email-sent" }))).toBe("sending");
  });

  it("reads status strictly: an unknown or missing status fails the read", () => {
    expect(parsePlatformPrices([row({})])).toHaveLength(1);
    expect(() => parsePlatformPrices([{ ...row({}), status: undefined }])).toThrow();
    expect(() => parsePlatformPrices([{ ...row({}), status: "paused" }])).toThrow();
    expect(() => parsePlatformPrices([{ ...row({}), usageReadAt: undefined }])).toThrow();
    expect(() => parsePlatformPrices([{ ...row({}), lastUsedOn: undefined }])).toThrow();
  });

  it("an email sent is ONE line at the served bundle price, never the halves", () => {
    const bundle = { name: "email-sent", unit: "email", members: ["instantly-account-email-sent", "instantly-domain-email-sent"], pricePerUnitInUsdCents: "5.9772000000" };
    const rows = [
      row({ name: "instantly-account-email-sent", type: "Email send (per account)", pricePerUnitInUsdCents: "2.9886", bundle }),
      row({ name: "instantly-domain-email-sent", type: "Email send (per domain)", pricePerUnitInUsdCents: "2.9886", bundle }),
    ];
    const sending = catalogSections(rows).find((s) => s.key === "sending");
    expect(sending?.rows).toEqual([{ tool: "Instantly", domain: "instantly.ai", what: "Email sent", price: "$0.0598 / email" }]);
    const lost = catalogSections([row({ bundle: { ...bundle, pricePerUnitInUsdCents: null } })]).find((s) => s.key === "sending");
    expect(lost?.rows[0].price).toBe("No price");
  });

  it("hides a line unused for 30+ days, measured from the usage read, not from today", () => {
    expect(catalogGroup(row({ lastUsedOn: null }))).toBeNull();
    expect(catalogGroup(row({ lastUsedOn: "2026-09-05", usageReadAt: "2026-10-06T08:00:00Z" }))).toBeNull();
    expect(catalogGroup(row({ lastUsedOn: "2026-09-07", usageReadAt: "2026-10-06T08:00:00Z" }))).toBe("sending");
    expect(catalogGroup(row({ lastUsedOn: "2026-01-02", usageReadAt: "2026-01-03T00:00:00Z" }))).toBe("sending");
  });

  it("Postmark sits under the emails we send you, never under cold email sending", () => {
    expect(catalogGroup(row({ name: "postmark-email-send", provider: "postmark" }))).toBe("notifications");
  });

  it("an unknown provider is listed under Other tools and logged, never dropped", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(catalogGroup(row({ provider: "newvendor", unit: "call" }))).toBe("other");
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("leaves out units we never charge for", () => {
    const leads = catalogSections(FIXTURE).find((s) => s.key === "leads");
    expect(leads).toBeUndefined();
  });

  it("deduplicates rows sharing a label and price", () => {
    const sending = catalogSections(FIXTURE).find((s) => s.key === "sending");
    expect(sending?.rows).toHaveLength(1);
  });

  it("renders the readable label, never the internal cost name", () => {
    const html = renderCatalogPage(FIXTURE);
    expect(html).toContain("Input tokens (Sonnet 5.5)");
    expect(html).not.toContain("anthropic-sonnet-5.5-tokens-input");
    expect(html).not.toContain("Meta Ads");
  });

  it("a failed read says so instead of listing nothing", () => {
    expect(renderCatalogPage(null)).toContain("could not be read just now");
  });
});

describe("catalog copy", () => {
  const html = renderCatalogPage(FIXTURE);
  const lower = html.toLowerCase();

  it("is never called pricing and names no plan", () => {
    expect(html).toContain("<h1>What your emails cost</h1>");
    expect(html).toContain('<link rel="canonical" href="https://distribute.you/catalog">');
    // The page's own words, from the hero to the shared closing CTA box (the shell's,
    // which states the offer on every page and moves with it).
    const own = html.slice(html.indexOf("<h1>"), html.indexOf('class="cta-box'));
    expect(own).toContain("Full price list");
    expect(own).not.toMatch(/\$99|free trial|per month|\/month/i);
  });

  it("states the reasoning: cost per customer, not cost per email", () => {
    expect(html).toContain("Why we don&apos;t charge per email".replace("&apos;", "'"));
    expect(html).toContain("Your cost per new customer. Not your cost per email.");
    expect(html).toContain("5 to 10 days");
  });

  it("keeps the margin inside the price and no banned framing", () => {
    expect(html).toContain("Our margin is included.");
    for (const banned of ["at cost", "pass-through", "no markup", "costs us", "workflow", "pay as you go"]) {
      expect(lower).not.toContain(banned);
    }
    expect(html).not.toContain(String.fromCharCode(0x2014));
    expect(html).not.toContain(String.fromCharCode(0x2013));
  });
});

describe("catalog is reachable", () => {
  const ROOT = path.resolve(__dirname, "../..");
  const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

  it("every footer and the sitemap link it", () => {
    expect(read("public/landing/index-v2.html")).toContain('<a href="/catalog">Price catalog</a>');
    expect(read("src/lib/v2-shell.ts")).toContain('<a href="/catalog">Price catalog</a>');
    expect(read("src/components/footer.tsx")).toContain('{ label: "Price catalog", href: "/catalog" }');
    expect(read("src/app/sitemap.ts")).toContain('path: "/catalog"');
  });
});
