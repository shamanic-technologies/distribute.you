import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const card = read("src/components/billing/coming-credits-card.tsx");
const page = read("src/app/(authed)/(dashboard)/orgs/[orgId]/billing/page.tsx");
const api = read("src/lib/api.ts");
const persist = read("src/lib/persist-cache.ts");

// Source-substring guards: the component imports through the `@` alias, which
// vitest does not resolve here. The pure logic lives in lib/free-credit-promise-view.ts
// and is covered by real unit tests.

describe("the On the way card", () => {
  it("sits on the Billing page", () => {
    expect(page).toContain("<ComingCreditsCard />");
    expect(page).toContain('from "@/components/billing/coming-credits-card"');
  });

  it("renders every figure the server sent and computes none", () => {
    // A promise's amount, what is left to unlock it, and its progress are all
    // features-of-the-producer. Dividing or summing them here would be the
    // compute-a-metric-in-the-browser bug.
    expect(card).toContain("promise.amountCents");
    expect(card).toContain("promise.remainingToUnlockCents");
    expect(card).toContain("promise.progressPct");
    expect(card).not.toMatch(/paidSoFarCents\s*\//);
    expect(card).not.toContain("reduce(");
  });

  it("keys the logo on the DOMAIN, never on the org name", () => {
    // logo.dev resolves a domain. Passing a company NAME empties the slot with no
    // error anywhere, which is exactly how a logo silently disappears.
    expect(card).toContain("domain={promise.referredOrgDomain}");
    expect(card).not.toContain("domain={promise.referredOrgName");
  });

  it("shows nothing at all when the org has nothing coming", () => {
    // An empty card announcing that no credits are on the way is noise on a page
    // about money the customer already has.
    expect(card).toContain("promises.length === 0)) return null");
  });

  it("reveals on settle, so a failed read cannot skeleton forever", () => {
    expect(card).toContain("isError");
  });
});

describe("the promises reader", () => {
  it("declares the display identity OPTIONAL so it needs no rollout gate", () => {
    // billing resolves the referred org's name and domain in a follow-up. A
    // required field would break this reader against the deploy that is live now.
    expect(api).toContain("referred_org_name: z.string().nullable().optional()");
    expect(api).toContain("referred_org_domain: z.string().nullable().optional()");
  });

  it("declares the outstanding total OPTIONAL, so it needs no rollout gate", () => {
    // Additive, and it shipped after the rows did. A body from the deploy that
    // predates it must still parse, and an absent total is not a zero.
    expect(api).toContain("outstanding_total_cents: z.string().optional()");
    expect(api).toContain("parsed.data.outstanding_total_cents ?? null");
  });

  it("requires the money fields, which are live today", () => {
    expect(api).toContain("amount_cents: z.string()");
    expect(api).toContain("paid_trigger_cents: z.string()");
    expect(api).toContain("remaining_to_unlock_cents: z.string()");
  });

  it("is persisted, so the card paints from disk instead of cold-fetching", () => {
    expect(persist).toContain('"freeCreditPromises"');
  });
});
