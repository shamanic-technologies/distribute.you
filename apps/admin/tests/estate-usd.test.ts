import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FX_UNAVAILABLE_NOTE,
  billedNative,
  fxRateLine,
  usdTotal,
  vendorMailboxMismatch,
} from "../src/lib/estate-usd";

/**
 * The Domains page states the cold-email estate in ONE currency, USD, read off
 * the twins instantly-service serves. Before this, the "Monthly cost" card
 * summed euro cents and dollar cents and printed the result as dollars
 * (~$898 where the real figure was ~$928).
 */

const FX = { base: "EUR", quote: "USD", rate: 1.1411, asOf: "2026-09-23", source: "ecb-eurofxref-daily" };

describe("fxRateLine", () => {
  it("states the rate, its source and its date off the served block", () => {
    expect(fxRateLine(FX)).toBe("EUR converted at 1 EUR = $1.1411 (ECB reference rate, 23 Sep 2026)");
  });

  it("names an unknown source verbatim rather than inventing a label", () => {
    expect(fxRateLine({ ...FX, source: "some-bank" })).toContain("(some-bank, 23 Sep 2026)");
  });

  it("carries no em-dash", () => {
    expect(fxRateLine(FX)).not.toContain("—");
    expect(FX_UNAVAILABLE_NOTE).not.toContain("—");
  });
});

describe("usdTotal", () => {
  it("sums the USD twins, never the native cents", () => {
    // €38.38 served as $43.80, plus a $14.00 row.
    const t = usdTotal([
      { native: 3838, usd: 4380 },
      { native: 1400, usd: 1400 },
    ]);
    expect(t).toEqual({ kind: "total", cents: 5780, unpriced: 0 });
  });

  it("counts an unpriced row and adds nothing for it", () => {
    const t = usdTotal([
      { native: 1400, usd: 1400 },
      { native: null, usd: null },
    ]);
    expect(t).toEqual({ kind: "total", cents: 1400, unpriced: 1 });
  });

  it("refuses a partial total when a priced row has no USD twin (no rate)", () => {
    const t = usdTotal([
      { native: 1400, usd: 1400 },
      { native: 3838, usd: null },
    ]);
    expect(t).toEqual({ kind: "unavailable", unconvertible: 1 });
  });

  it("answers a zero total for an empty set, which is a real answer", () => {
    expect(usdTotal([])).toEqual({ kind: "total", cents: 0, unpriced: 0 });
  });
});

describe("billedNative", () => {
  it("keeps a euro amount as provenance", () => {
    expect(billedNative(320, "EUR")).toBe("billed €3.20");
  });

  it("adds nothing for dollars or an absent amount", () => {
    expect(billedNative(320, "USD")).toBeNull();
    expect(billedNative(null, "EUR")).toBeNull();
    expect(billedNative(320, null)).toBeNull();
  });
});

describe("vendorMailboxMismatch", () => {
  it("never flags a vendor that does not report mailboxes (Instantly DFY)", () => {
    expect(vendorMailboxMismatch({ vendorReportsMailboxes: false, vendorMailboxes: 0, mailboxes: 3 })).toBe(false);
  });

  it("flags a reporting vendor whose count disagrees with ours", () => {
    // Mailforge `not_paid` domains really host zero mailboxes: a true warning.
    expect(vendorMailboxMismatch({ vendorReportsMailboxes: true, vendorMailboxes: 0, mailboxes: 3 })).toBe(true);
  });

  it("stays quiet when the counts agree", () => {
    expect(vendorMailboxMismatch({ vendorReportsMailboxes: true, vendorMailboxes: 3, mailboxes: 3 })).toBe(false);
  });
});

describe("the Domains page reads the USD twins", () => {
  const ROOT = join(__dirname, "..", "src");
  const page = readFileSync(join(ROOT, "app/(authed)/(dashboard)/audit/cold-email/domains/page.tsx"), "utf8");
  const costs = readFileSync(join(ROOT, "components/audit/estate-costs-panel.tsx"), "utf8");
  const events = readFileSync(join(ROOT, "components/audit/estate-events-panel.tsx"), "utf8");

  it("totals the stat card over live USD twins, with an unavailable branch", () => {
    expect(page).toContain("usdTotal(");
    expect(page).toContain("liveDomains(domains)");
    expect(page).toContain("d.cost.usd.monthlyCents");
    expect(page).toContain('"Unavailable"');
    // The old euro-plus-dollar sum is gone.
    expect(page).not.toContain("s + (d.cost.monthlyCents ?? 0)");
  });

  it("renders every table money cell off the USD twin", () => {
    expect(page).toContain("usd={d.cost.usd.monthlyCents}");
    expect(page).toContain("d.cost.usd.perEmailCents");
    expect(page).toContain("usdCents={d.cost.usd.paidToDateCents}");
    expect(page).toContain("usdCents={row.cost.usd.paidToDateCents}");
  });

  it("states the rate from the served fx, never a constant", () => {
    expect(page).toContain("fxRateLine(fx)");
    expect(costs).toContain("fxRateLine(fx)");
    for (const src of [page, costs, events]) expect(src).not.toMatch(/1\.1[0-9]{2,}/);
  });

  it("has no currency toggle and no 'nobody owns a rate' note", () => {
    expect(costs).not.toContain("setCurrency");
    expect(costs).not.toContain("nobody here owns");
    expect(costs).toContain("FX_UNAVAILABLE_NOTE");
  });

  it("prices the next events in USD with the native figure beside it", () => {
    expect(events).toContain('formatCents(event.renewalUsdCents, "USD")');
    expect(events).toContain("billedNative(");
  });

  it("warns 'vendor says' only for a vendor that reports mailboxes", () => {
    expect(page).toContain("vendorMailboxMismatch(d)");
    expect(page).not.toContain("d.vendorMailboxes !== d.mailboxes");
    expect(page).toContain("row.vendorReportsMailboxes");
  });

  it("carries no em-dash in new copy", () => {
    for (const lit of ["no USD rate", "not reported by this vendor", "no EUR to USD rate on record"]) {
      expect(page).toContain(lit);
      expect(lit).not.toContain("—");
    }
  });
});
