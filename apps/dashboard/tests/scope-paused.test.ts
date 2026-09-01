import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  pausedByFunnel,
  pausedByOffer,
  scopeIsPaused,
  scopePausedFor,
} from "../src/lib/scope-paused";
import { rollupStatus, type ControlRow } from "../src/lib/campaign-controls";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

const row = (over: Partial<ControlRow>): ControlRow => ({
  rowId: over.rowId ?? "r",
  campaignId: over.campaignId ?? "c",
  runningCampaignIds: over.running ? [over.campaignId ?? "c"] : [],
  running: over.running ?? false,
  scope: over.scope ?? null,
  savedCents: 0,
  offerId: over.offerId ?? null,
  legKey: null,
});

const funnelScope = (key: string) =>
  ({ def: { key }, featureSlug: "sales-cold-email-outreach" }) as unknown as ControlRow["scope"];

describe("scopeIsPaused", () => {
  it("says a scope with no campaign at all is NOT paused", () => {
    // `none` is its own answer: "there is nothing here" is not "everything is stopped",
    // so a scope nobody has ever run keeps whatever word it read before.
    expect(scopeIsPaused([])).toBe(false);
  });

  it("says a scope whose every campaign is stopped IS paused", () => {
    expect(scopeIsPaused([{ running: false }])).toBe(true);
    expect(scopeIsPaused([{ running: false }, { running: false }])).toBe(true);
  });

  it("clears the moment ONE campaign runs", () => {
    // Deliberately no third word for a mixed scope — one funnel live beside an older one
    // stopped on purpose is a brand doing exactly what it meant to.
    expect(scopeIsPaused([{ running: false }, { running: true }])).toBe(false);
  });

  it("is the SAME verdict the scope's own header pill renders", () => {
    // One derivation, so a page cannot say Paused at the top and Learning in the middle.
    for (const rows of [
      [],
      [{ running: false }],
      [{ running: true }],
      [{ running: false }, { running: true }],
    ]) {
      expect(scopeIsPaused(rows)).toBe(rollupStatus(rows) === "paused");
    }
  });
});

describe("pausedByOffer", () => {
  it("answers per offer, and one running campaign clears that offer alone", () => {
    const map = pausedByOffer([
      row({ rowId: "a1", offerId: "A", running: false }),
      row({ rowId: "a2", offerId: "A", running: true }),
      row({ rowId: "b1", offerId: "B", running: false }),
    ]);
    expect(map.get("A")).toBe(false);
    expect(map.get("B")).toBe(true);
  });

  it("leaves out a campaign that names no offer", () => {
    // It belongs to none, so folding it into whichever offer the reader is looking at
    // would answer for a proposition it never sold.
    const map = pausedByOffer([row({ rowId: "x", offerId: null, running: false })]);
    expect(map.size).toBe(0);
  });
});

describe("pausedByFunnel", () => {
  it("answers per funnel, keyed on the funnel the money is keyed on", () => {
    const map = pausedByFunnel([
      row({ rowId: "f1", scope: funnelScope("reply_meeting"), running: false }),
      row({ rowId: "f2", scope: funnelScope("visit_signup"), running: true }),
    ]);
    expect(map.get("reply_meeting")).toBe(true);
    expect(map.get("visit_signup")).toBe(false);
  });

  it("leaves out a campaign that predates the funnels", () => {
    const map = pausedByFunnel([row({ rowId: "old", scope: null, running: false })]);
    expect(map.size).toBe(0);
  });
});

describe("scopePausedFor", () => {
  const map = new Map([["A", true]]);

  it("cannot tell while the read is unsettled", () => {
    expect(scopePausedFor(map, "A", false)).toBe(false);
  });

  it("reads a scope absent from the map as unmeasured, never as stopped", () => {
    expect(scopePausedFor(map, "B", true)).toBe(false);
    expect(scopePausedFor(map, null, true)).toBe(false);
  });

  it("reads the verdict when there is one", () => {
    expect(scopePausedFor(map, "A", true)).toBe(true);
  });
});

describe("the hook reads the SAME rows the header pill does", () => {
  const hook = read("lib/use-scope-paused.ts");

  it("builds controls rows rather than re-deriving a second campaign list", () => {
    expect(hook).toContain("buildControlRows(");
    expect(hook).toContain('useAuthQuery(["campaigns", brandId]');
  });

  it("costs no second query for money it does not state", () => {
    // `running` is campaign-service's own word on the row; the budget set only fills
    // `savedCents`, which nothing here reads.
    expect(hook).toContain("buildControlRows(campaignsQ.data?.campaigns ?? [], undefined, channels");
    expect(hook).not.toContain("brandFunnelBudgets");
  });

  it("reveals on SETTLE, so a failed read keeps the word the surface read before", () => {
    expect(hook).toContain("campaignsQ.data !== undefined || campaignsQ.isError");
    expect(hook).toContain("settled ? scopeIsPaused(rows) : false");
  });
});

describe("every surface PASSES the flag, not merely handles it", () => {
  // A component that honours `paused` while no page passes it is the feature entirely
  // absent with the component perfectly correct. So these pin the CALL SITE.
  const sliceFrom = (src: string, marker: string, len: number) => {
    const at = src.indexOf(marker);
    expect(at, `missing marker: ${marker}`).toBeGreaterThan(-1);
    return src.slice(at, at + len);
  };

  it("the funnel Overview states its funnel's verdict on the row and the return chart", () => {
    const src = read("components/funnels/funnel-overview-page.tsx");
    expect(src).toContain("useScopePaused(");
    expect(sliceFrom(src, "<RevenueOverviewSection", 2400)).toContain("paused={scopePaused}");
    expect(sliceFrom(src, "<OutreachStatCards", 1600)).toContain("paused={scopePaused}");
  });

  it("the brand Overview states the brand's verdict", () => {
    const src = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
    expect(src).toContain("useScopePaused(");
    expect(sliceFrom(src, "<RevenueOverviewSection", 3000)).toContain("paused={scopePaused}");
    expect(sliceFrom(src, "<OutreachStatCards", 1600)).toContain("paused={scopePaused}");
    expect(sliceFrom(src, "<TopAudiencesCard", 900)).toContain("paused={scopePaused}");
  });

  it("covers the OFFER Overview through the same component, scoped by the route", () => {
    // The offer route re-exports the brand page rather than copying it, so one
    // `useScopePaused(brandId, { offerId })` answers at both grains — `offerId` is
    // undefined at brand level, which is a first-class scope and not a missing value.
    const route = read(
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/page.tsx",
    );
    expect(route).toContain("brands/[brandId]/page");
    const src = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
    expect(src).toContain("useScopePaused(brandId, { offerId, enabled })");
  });

  it("the Campaigns page states the verdict of the scope its route names", () => {
    const src = read("components/campaigns/campaigns-page.tsx");
    expect(src).toContain("useScopePaused(");
    expect(src).toContain("paused={scopePaused}");
  });

  it("the funnel leg page states its funnel's verdict", () => {
    const src = read("components/funnels/funnel-leg-page.tsx");
    expect(src).toContain("useScopePaused(");
    expect(src).toContain("paused={scopePaused}");
  });

  it("the shared Audiences page falls back to its SCOPE when no campaign is named", () => {
    const src = read("components/audiences/customer-audiences-page.tsx");
    expect(src).toContain("useScopePaused(");
    expect(src).toContain("campaignPaused || scopePaused");
  });

  it("the shared stat-card wrapper falls back to its SCOPE too", () => {
    const src = read("components/revenue/outreach-stat-cards-auto.tsx");
    expect(src).toContain("useScopePaused(");
    expect(src).toContain("campaignPaused || scopePaused");
  });

  it("the Offers table reads a per-offer verdict rather than one scope's", () => {
    const src = read("components/offers/offers-table.tsx");
    expect(src).toContain("usePausedByOffer(");
    expect(src).toContain("scopePausedFor(");
  });

  it("the funnels table reads a per-funnel verdict", () => {
    const src = read("components/funnels/offer-funnels-page.tsx");
    expect(src).toContain("usePausedByFunnel(");
    expect(src).toContain("scopePausedFor(");
  });

  it("leaves the Outcome chart alone, because a COUNT is never gated", () => {
    // The learning bar governs a figure that DIVIDES by an outcome count. This chart
    // states the count itself, which is a fact at any size — and the count is also what
    // shows the bar being approached. Tagging it would withhold the one number that
    // explains why the others are withheld.
    const src = read("components/revenue/outcome-trend-card.tsx");
    expect(src).not.toContain("LearningTag");
  });
});
