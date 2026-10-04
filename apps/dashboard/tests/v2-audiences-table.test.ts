import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  audienceColumns,
  audienceFigure,
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
// A row carrying its served maturity pairs (features-service#1196). The verdict is the
// producer's: `isMature` decides Learning, never a count against a bar.
const stats = (
  replies: number,
  cppr: number | null,
  isMature: boolean | null = true,
  spent = 1000,
): FeatureAudienceStatsRow =>
  ({
    audienceId: "",
    audience: { id: "" },
    evidence: { positiveReplies: replies, websiteClicks: 0, contacted: 10, totalCostInUsdCents: spent },
    // the legacy floored ranking figures: never stated, never sorted on
    metrics: {
      cpprCents: 1,
      cpcCents: null,
      maturity: {
        flash: { cpcCents: null, cpprCents: cppr, cpfsCents: null, cpsCents: null, cpsaleCents: null },
        mature: { cpcCents: null, cpprCents: cppr, cpfsCents: null, cpsCents: null, cpsaleCents: null },
        isMature,
      },
    },
    projection: {
      returnPerDollar: 99,
      maturity: {
        flash: { returnPerDollar: 1.5, costOfAcquisitionPct: 60, costPerPaidClientUsd: 300 },
        mature: { returnPerDollar: 2.5, costOfAcquisitionPct: 40, costPerPaidClientUsd: 200 },
        isMature,
      },
    },
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

  it("Learning is the producer's verdict on the row; no stats row is not Learning", () => {
    // 500 replies change nothing: nothing is counted against a bar here.
    expect(audienceFigure("cppr", stats(500, 700, false), "mature")).toEqual({ value: null, learning: true });
    expect(audienceFigure("cppr", stats(3, 700, true), "mature")).toEqual({ value: 700, learning: false });
    expect(audienceFigure("cppr", undefined, "mature")).toEqual({ value: null, learning: false });
    expect(audienceFigure("outreach", stats(0, null), "mature")).toEqual({ value: null, learning: false });
  });

  it("states the MATURE money off the projection pair, never the legacy projection", () => {
    expect(audienceFigure("roi", stats(3, 700), "mature").value).toBe(2.5);
    expect(audienceFigure("cacPct", stats(3, 700), "mature").value).toBe(40);
    expect(audienceFigure("cacUsd", stats(3, 700), "flash").value).toBe(300);
  });

  it("learning rows sink below measured ones, ordered by the count they divide by", () => {
    const s: Record<string, FeatureAudienceStatsRow> = {
      a: stats(12, 900),
      b: stats(3, 100, false),
      c: stats(15, 400),
      d: stats(7, 50, false),
    };
    const rows = ["a", "b", "c", "d"].map((id) => audience(id, id));
    const out = sortAudiences(rows, {
      sortCol: "cppr",
      sortDir: "asc",
      tieBreakCol: null,
      statsFor: (id) => s[id],
      basis: "mature",
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
    expect(targeting.slice(0, 1200)).toContain("<V2AudiencesTable offerId={offerId} plain />");
  });

  it("the offer's Targeting reads in plain words: each audience's sentence, no figure column", () => {
    const list = table.slice(table.indexOf("function PlainAudienceList("), table.indexOf("function SortTh("));
    expect(list).toContain("a.description");
    expect(list).not.toContain("AudienceCell");
    expect(table).toContain("const columns = plain ? [] : t.columns;");
    expect(table).toContain("columns={columns}");
  });

  it("the offer's Targeting panel is the audience's text and the channels using it, no Apollo filter, provider or match count", () => {
    const drawer = table.slice(table.indexOf("function AudienceDrawer("));
    expect(drawer).toContain("!signal && !plain ? audienceFilterGroups(audience.filters)");
    expect(drawer).toContain('<p className="k-label mb-2">Who</p>');
    expect(drawer).toContain('<p className="k-label mb-2">Used by</p>');
    expect(drawer).toContain("{signal && !plain && (");
    expect(drawer).toContain("{!plain && (\n        <section>\n          <p className=\"k-label mb-2\">Details</p>");
    expect(table).toContain("plain={plain}");
  });

  it("the offer's Targeting lists suggested audiences and leaves out LinkedIn signal ones", () => {
    expect(table).toContain("useAudienceTable({ campaignId, offerId, includeSuggested: plain })");
    expect(table).toContain("plain ? t.audiences.filter((a) => !linkedInSignalOf(a.filters)) : t.audiences");
    expect(table).toContain('key: "suggested"');
    expect(table).toContain('<StatusBtn label="Activate" to="active" />');
    expect(hook).toContain('["audiences", brandId, "suggested", offerId ?? "brand"]');
    expect(hook).toContain("{ enabled: includeSuggested, ...pollOptions }");
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
    // Learning is read off each row's served pair, so no second per-campaign fan-out.
    expect(hook).not.toContain("useAudienceLearning");
  });

  it("the drawer's portal host is read after mount, never at render (a deep link would land outside .v2-root)", () => {
    expect(table).toContain('useEffect(() => setHost(document.getElementById("v2-portal")), [])');
    expect(table).not.toContain('document.getElementById("v2-portal") ?? document.body');
  });

  it("the chat states the offer, or an audience created here lands brand-wide", () => {
    expect(table).toContain("...(t.offerId ? { offerId: t.offerId } : {})");
  });
});
