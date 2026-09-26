import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * The SALES FUNNEL is retired from this app (wave C1). The model is
 * org > brand > offer > outcome > leg: a campaign is (offer x leg x channel), money is
 * billing's per (offer, leg, channel), rates are per leg, lifetime revenue per offer.
 *
 * Nothing in `src` may read or write a funnel. The only places the word survives are a
 * producer's HISTORICAL wire names, read at one parse boundary each and handed on under
 * a leg/step name. A new one is a decision, not an accident: add it here with the reason.
 */
const SRC = join(__dirname, "../src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(path);
  }
  return out;
}

const FILES = walk(SRC).map((path) => ({ rel: relative(SRC, path), src: readFileSync(path, "utf8") }));

/** Producer wire names, read once each and renamed on the way in. */
const WIRE_NAME_FILES: Record<string, string> = {
  // features-service's revenue body names its step walk `funnelSteps`; parsed into `stepWalk`.
  "lib/revenue-parse.ts": "funnelSteps",
};

describe("no sales funnel in apps/dashboard/src", () => {
  it("names no funnel key", () => {
    const hits = FILES.filter((f) => /funnelKey/.test(f.src)).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it("calls none of the retired funnel readers or writers", () => {
    const banned = /getBrandSalesFunnels|getOfferSalesFunnels|declareBrandSalesFunnel|undeclareBrandSalesFunnel|stateBrandSalesFunnels|saveBrandFunnelBudget|stateBrandFunnelBudgets|getBrandFunnelBudgets/;
    const hits = FILES.filter((f) => banned.test(f.src)).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it("sends no `funnel` query param on any read", () => {
    const banned = /[?&]funnel=|set\(\s*["']funnel["']|funnel:\s*[a-zA-Z]/;
    const hits = FILES.filter((f) => banned.test(f.src)).map((f) => f.rel);
    expect(hits).toEqual([]);
  });

  it("says funnel only where a producer's wire name forces it", () => {
    const hits = FILES.filter((f) => /funnel/i.test(f.src)).map((f) => f.rel).sort();
    expect(hits).toEqual(Object.keys(WIRE_NAME_FILES).sort());
    for (const [rel, name] of Object.entries(WIRE_NAME_FILES)) {
      const file = FILES.find((f) => f.rel === rel)!;
      expect(file.src).toContain(name);
    }
  });

  it("the deleted funnel modules stay deleted", () => {
    const rels = new Set(FILES.map((f) => f.rel));
    for (const gone of [
      "lib/sales-funnels.ts",
      "lib/campaign-leg.ts",
      "lib/launch-funnel.ts",
      "lib/onboarding-funnel-view.ts",
      "lib/funnel-channels.ts",
      "components/marks/sales-funnel-mark.tsx",
      "components/settings/brand-sales-funnels-card.tsx",
    ]) {
      expect(rels.has(gone)).toBe(false);
    }
  });
});
