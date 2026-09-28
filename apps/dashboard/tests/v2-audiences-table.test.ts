import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  audienceColumns,
  audienceCostIsLearning,
  formatAudienceCents,
  sortAudiences,
  type AudienceColumnFlags,
} from "../src/lib/audience-table-model";
import type { AudienceWire, FeatureAudienceStatsRow } from "../src/lib/api";

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const OFF: AudienceColumnFlags = {
  brandLevelMoney: false,
  campaignScoped: false,
  showSaleCols: false,
  showReplyCols: false,
  showSignupCols: false,
  showFormSubmissionCols: false,
  showVisitCols: false,
};

const audience = (id: string, name: string): AudienceWire => ({ id, name, status: "active" }) as unknown as AudienceWire;
const stats = (replies: number, cppr: number | null, spent = 1000): FeatureAudienceStatsRow =>
  ({
    audienceId: "",
    audience: { id: "" },
    evidence: { positiveReplies: replies, websiteClicks: 0, contacted: 10, totalCostInUsdCents: spent },
    metrics: { cpprCents: cppr, cpcCents: null },
  }) as unknown as FeatureAudienceStatsRow;

describe("audience table model", () => {
  it("offer grain states money, never a leg's step pair", () => {
    const cols = audienceColumns({ ...OFF, brandLevelMoney: true }).map((c) => c.col);
    expect(cols).toEqual(["roi", "cacPct", "cacUsd", "invested", "outreach", "remaining", "size"]);
  });

  it("campaign grain states its leg's pair, then $ Invested left of Outreach", () => {
    const cols = audienceColumns({ ...OFF, campaignScoped: true, showReplyCols: true }).map((c) => c.col);
    expect(cols).toEqual(["replies", "cppr", "invested", "outreach", "remaining", "size"]);
  });

  it("a thin price is learning; no stats row is not", () => {
    expect(audienceCostIsLearning("cppr", stats(3, 500))).toBe(true);
    expect(audienceCostIsLearning("cppr", stats(12, 500))).toBe(false);
    expect(audienceCostIsLearning("cppr", undefined)).toBe(false);
    expect(audienceCostIsLearning("outreach", stats(0, null))).toBe(false);
  });

  it("learning rows sink below measured ones, ordered by the count they divide by", () => {
    const s: Record<string, FeatureAudienceStatsRow> = {
      a: stats(12, 900),
      b: stats(3, 100),
      c: stats(15, 400),
      d: stats(7, 50),
    };
    const rows = ["a", "b", "c", "d"].map((id) => audience(id, id));
    const out = sortAudiences(rows, {
      sortCol: "cppr",
      sortDir: "asc",
      tieBreakCol: null,
      statsFor: (id) => s[id],
      moneyLearning: () => false,
    });
    expect(out.map((r) => r.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("a missing figure is an em dash, never a fabricated zero", () => {
    expect(formatAudienceCents(null)).toBe("—");
    expect(formatAudienceCents(450)).toBe("$4.50");
    expect(formatAudienceCents(12345)).toBe("$123");
  });
});

describe("v2 audience table surface", () => {
  const table = read("src/components/v2/audiences-table.tsx");
  const hook = read("src/components/v2/use-audience-table.ts");
  const setup = read("src/components/v2/setup-pages.tsx");

  it("both v2 pages mount the v2 table, not v1's page", () => {
    expect(setup).not.toContain("<CustomerAudiencesPage");
    const targeting = setup.slice(setup.indexOf("export function V2TargetingPage("));
    expect(targeting.slice(0, 1200)).toContain("<V2AudiencesTable offerId={offerId} />");
  });

  it("uses Keel's records anatomy and a portalled drawer", () => {
    for (const s of ["RecordsTabs", "RecordsToolbar", "RecordsFooter", "useRowKeys", "k-row h-10", "k-popover", '"v2-portal"']) {
      expect(table).toContain(s);
    }
  });

  it("carries no v1 class family and no per-header tooltip", () => {
    for (const src of [table, hook]) {
      expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|InfoTooltip|shadow-2xl|bg-white/);
    }
  });

  it("forks no data layer: v1's query keys, readers and invalidations", () => {
    expect(hook).toContain('["audiences", brandId, "active", offerId ?? "brand"]');
    expect(hook).toContain('"featureAudienceStats",');
    expect(hook).toContain('"all-statuses",');
    expect(hook).toContain("setAudienceStatus(i.id, i.status)");
    expect(hook).toContain('invalidateQueries({ queryKey: ["audiences", brandId] })');
    expect(hook).toContain("useAudienceLearning(brandId, soleFeatureSlug, offerId)");
  });

  it("the drawer's portal host is read after mount, never at render (a deep link would land outside .v2-root)", () => {
    expect(table).toContain('useEffect(() => setHost(document.getElementById("v2-portal")), [])');
    expect(table).not.toContain('document.getElementById("v2-portal") ?? document.body');
  });

  it("the chat states the offer, or an audience created here lands brand-wide", () => {
    expect(table).toContain("...(t.offerId ? { offerId: t.offerId } : {})");
  });
});
