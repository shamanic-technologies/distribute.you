import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * A domain the DNS sweep has NEVER PROBED is served as `dns: null`, and that is
 * a different fact from its records being absent.
 *
 * The first cut of the Domains page declared `dns` required-and-non-nullable
 * from a two-row sample, so the whole page threw `invalid response shape` in
 * production on the single row (of 80) the sweep does not cover — a Gandi
 * registrar-only domain we neither own mailboxes on nor send from. The fixture
 * below is that row, verbatim off prod on 2026-09-19.
 *
 * ⚠️ The fix is NOT only "make it nullable". A nullable field that still gets
 * GRADED prints four red MISSING badges for records that may well exist, which
 * is the same lie one layer down. So the surfaces state that it was not read.
 */

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.resolve(ROOT, rel), "utf-8");

/** The `outcaged.com` row, verbatim from `GET /internal/ops/domains` in prod. */
const UNPROBED_ROW = {
  domain: "outcaged.com",
  provider: "gandi",
  role: "registrar",
  status: "clientHold,clientTransferProhibited",
  expiresAt: "2026-07-03T05:59:48.000Z",
  autorenew: false,
  deletionScheduled: false,
  cancelledAt: null,
  absentSince: "2026-08-17T05:37:04.983Z",
  purchasedAt: null,
  vendorMailboxes: 0,
  mailboxes: 5,
  addresses: { total: 0, byLifecycle: {} },
  sentLast30d: 0,
  volume30d: { outreach: 0, warmup: 0, seed: 0, repliesIn: 0, bouncesIn: 0, bounceRatePerMille: null },
  delivery: { inboxCount: 0, seedTotal: 0, inboxPct: null, testedAt: null, measuredAccounts: 0 },
  dns: null,
  cost: {
    monthlyCents: 320,
    currency: "EUR",
    source: "api",
    perEmailCents: null,
    recurringMonthlyCents: null,
    renewalCents: 3838,
    renewalAt: "2026-07-03T05:59:48.000Z",
    paidToDate: { cents: 4800, currency: "EUR", source: "estimate", since: "2025-07-03T05:59:48.000Z", months: 15 },
  },
};

describe("the reader accepts a domain the DNS sweep never probed", () => {
  const api = read("src/lib/api.ts");

  it("declares dns NULLABLE — a required non-nullable field threw the whole page on one row of eighty", () => {
    expect(api).toContain("dns: OpsDnsSchema.nullable(),");
  });

  it("says in the schema WHY null is a different fact from absent records", () => {
    const at = api.indexOf("dns: OpsDnsSchema.nullable(),");
    const comment = api.slice(Math.max(0, at - 400), at);
    expect(comment.toLowerCase()).toContain("never been dns-probed");
  });

  it("keeps every OTHER field of that row exactly as the producer serves it", () => {
    // Everything else on the prod row is a value the schema already admits —
    // a null expiry, a null cancellation, a null bounce rate, a EUR cost. This
    // pins them so a future tightening cannot re-break the same row.
    expect(UNPROBED_ROW.cancelledAt).toBeNull();
    expect(UNPROBED_ROW.purchasedAt).toBeNull();
    expect(UNPROBED_ROW.volume30d.bounceRatePerMille).toBeNull();
    expect(UNPROBED_ROW.delivery.inboxPct).toBeNull();
    expect(UNPROBED_ROW.cost.currency).toBe("EUR");
    expect(UNPROBED_ROW.cost.paidToDate?.source).toBe("estimate");
  });
});

describe("an unprobed domain is STATED, never graded", () => {
  const primitives = read("src/components/cold-email/primitives.tsx");
  const page = read("src/app/(authed)/(dashboard)/audit/cold-email/domains/page.tsx");

  it("the badge component takes a nullable dns and says it was not read", () => {
    expect(primitives).toContain("dns: OpsDns | null");
    expect(primitives).toContain("DNS not read");
  });

  it("does NOT hand a null to the grader — dnsBadges grades an OpsDns and refuses to invent one", () => {
    // The whole point: `dnsBadges(null)` would print four MISSING badges for
    // records nobody has looked for.
    const at = primitives.indexOf("export function DnsBadges(");
    const body = primitives.slice(at, primitives.indexOf("export function", at + 10));
    expect(body.indexOf("if (dns === null)")).toBeLessThan(body.indexOf("dnsBadges(dns)"));
  });

  it("the panel states the domain was never probed instead of printing a dash per record", () => {
    expect(page).toContain("row.dns ? dnsBadges(row.dns) : []");
    expect(page).toContain("row.dns ? Object.entries(row.dns.errors) : []");
    expect(page).toContain("has never been DNS-probed");
  });

  it("the DNS-attention count covers PROBED domains only, and states the rest separately", () => {
    // A domain nobody looked at is not a domain with a problem, and it is not a
    // domain that passed either — counting it as either invents a verdict.
    expect(page).toContain("d.dns !== null &&");
    expect(page).toContain("never probed");
  });
});
