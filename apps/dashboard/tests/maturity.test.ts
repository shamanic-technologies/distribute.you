import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MATURITY_LEARNING_NOTE,
  PAUSED_NOTE,
  maturityPairSchema,
  pairIsLearning,
  shownFigure,
  type MaturityPair,
} from "../src/lib/maturity";
import { STAT_BASIS_COOKIE, statBasisCookieAssignment, statBasisFromCookie } from "../src/lib/stat-basis-cookie";
import { z } from "zod";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

// features-service#1196: every ratio is served as a PAIR (flash, mature) with the
// producer's verdict. The dashboard states the mature half and tags Learning exactly where
// the producer says `isMature: false`. It decides nothing itself.
describe("shownFigure — one ratio, read off the served pair", () => {
  type F = { cpprCents: number | null };
  const pair = (p: Partial<MaturityPair<F>>): MaturityPair<F> => ({ flash: null, mature: null, isMature: null, ...p });
  const pick = (h: F) => h.cpprCents;

  it("states the MATURE half when the producer says the scope is mature", () => {
    expect(shownFigure(pair({ flash: { cpprCents: 900 }, mature: { cpprCents: 1500 }, isMature: true }), pick, "mature")).toEqual({
      value: 1500,
      learning: false,
    });
  });

  it("states Learning, and NO figure, where the producer says it is not mature", () => {
    // A figure beside a caveat reads as a price with a footnote: the tag replaces it.
    expect(shownFigure(pair({ flash: { cpprCents: 900 }, mature: { cpprCents: 1500 }, isMature: false }), pick, "mature")).toEqual({
      value: null,
      learning: true,
    });
  });

  it("reads the producer's null verdict as 'cannot judge': the mature value if any, never a tag", () => {
    expect(shownFigure(pair({ mature: { cpprCents: 700 }, isMature: null }), pick, "mature")).toEqual({ value: 700, learning: false });
    expect(shownFigure(pair({ mature: null, isMature: null }), pick, "mature")).toEqual({ value: null, learning: false });
  });

  it("states the FLASH half verbatim on the staff basis, never tagged", () => {
    expect(shownFigure(pair({ flash: { cpprCents: 900 }, mature: { cpprCents: 1500 }, isMature: false }), pick, "flash")).toEqual({
      value: 900,
      learning: false,
    });
  });

  it("states nothing for an absent pair", () => {
    expect(shownFigure(null, pick, "mature")).toEqual({ value: null, learning: false });
    expect(shownFigure(undefined, pick, "flash")).toEqual({ value: null, learning: false });
  });

  it("never falls back from one half onto the other", () => {
    // A null mature figure is "we could not measure this", never the flash figure.
    expect(shownFigure(pair({ flash: { cpprCents: 900 }, mature: null, isMature: true }), pick, "mature").value).toBeNull();
  });

  it("pairIsLearning is true only on an explicit false", () => {
    expect(pairIsLearning({ isMature: false })).toBe(true);
    expect(pairIsLearning({ isMature: true })).toBe(false);
    expect(pairIsLearning({ isMature: null })).toBe(false);
    expect(pairIsLearning(null)).toBe(false);
  });

  it("parses the served pair with every half nullable, and refuses a missing verdict key", () => {
    const schema = maturityPairSchema(z.object({ roiMultiple: z.number().nullable() }));
    expect(schema.safeParse({ flash: null, mature: { roiMultiple: 2 }, isMature: true }).success).toBe(true);
    expect(schema.safeParse({ flash: null, mature: null, isMature: null }).success).toBe(true);
    expect(schema.safeParse({ flash: null, mature: null }).success).toBe(false);
  });

  it("the Learning note quotes no number: the duration and the count are the producer's", () => {
    expect(MATURITY_LEARNING_NOTE).not.toMatch(/\d/);
    expect(MATURITY_LEARNING_NOTE).not.toContain("—");
    expect(PAUSED_NOTE).not.toContain("—");
  });
});

describe("the staff Mature / Flash switch", () => {
  it("reads flash only when the cookie says flash", () => {
    expect(statBasisFromCookie(null)).toBe("mature");
    expect(statBasisFromCookie("a=1")).toBe("mature");
    expect(statBasisFromCookie(`a=1; ${STAT_BASIS_COOKIE}=flash`)).toBe("flash");
    expect(statBasisFromCookie(`${STAT_BASIS_COOKIE}=anything`)).toBe("mature");
  });

  it("round-trips through its own assignment", () => {
    expect(statBasisFromCookie(statBasisCookieAssignment("flash").split(";")[0])).toBe("flash");
    expect(statBasisCookieAssignment("mature")).toContain("path=/");
  });

  it("forces every reader outside staff mode to the mature half, whatever the cookie says", () => {
    const hook = read("lib/use-stat-basis.ts");
    expect(hook).toContain('const basis: StatBasis = isStaff ? stored : "mature";');
    expect(hook).toContain('const readServer = (): StatBasis => "mature";');
    const sw = read("components/v2/stat-basis-switch.tsx");
    expect(sw).toContain("if (!isStaff) return null;");
    // Staff mode is what says which world you are in; the switch carries no tag.
    expect(sw).not.toContain('level="staff"');
    expect(hook).toContain("useStaffMode()");
  });

  it("rides the top bar of every v2 page that states a ratio", () => {
    for (const page of [
      "components/v2/today-page.tsx",
      "components/v2/missions-page.tsx",
      "components/v2/mission-page.tsx",
      "components/v2/crew-page.tsx",
      "components/v2/workflows-page.tsx",
      "components/v2/workflow-page.tsx",
    ]) {
      expect(read(page), page).toContain("<StatBasisSwitch />");
    }
  });
});

// The whole point of #1196: no count against a bar, no median, no floor onto spend, anywhere
// in the dashboard. These modules are GONE, and nothing may bring their rules back.
describe("no browser-side Learning threshold, median or spend floor remains", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }
  const files = walk(join(__dirname, "..", "src"));

  it("deletes the threshold, the per-offer / per-audience learning hooks and the spend floor", () => {
    for (const gone of [
      "lib/learning-threshold.ts",
      "lib/use-offer-learning.ts",
      "lib/use-audience-learning.ts",
      "lib/cost-so-far-floor.ts",
    ]) {
      expect(existsSync(join(__dirname, "..", "src", gone)), gone).toBe(false);
    }
  });

  it("imports none of them from anywhere in src", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const banned of [
        "learning-threshold",
        "use-offer-learning",
        "use-audience-learning",
        "cost-so-far-floor",
        "LEARNING_MIN_OUTCOMES",
        "costSoFarFloorCents(",
        "scopeIsLearning(",
        "audienceIsLearning(",
      ]) {
        expect(src.includes(banned), `${f} carries ${banned}`).toBe(false);
      }
    }
  });

  it("takes no median and picks no best of the fleet: both are SERVED", () => {
    const rows = read("lib/campaign-workflow-rows.ts");
    const fn = rows.slice(rows.indexOf("export function fleetComparison("), rows.indexOf("WHICH WORKFLOW SERVED ONE LEAD"));
    expect(fn).not.toContain(".sort(");
    expect(fn).not.toContain("length / 2");
    expect(fn).toContain("read.fleet.median?.costPerOutcomeUsd");
    expect(fn).toContain("read.fleet.best?.costPerOutcomeUsd");
  });
});

describe("every surface states the served mature figure", () => {
  it("the v2 Missions list, a mission and its crew read the per-campaign pairs", () => {
    expect(read("components/v2/missions-table.tsx")).toContain("outcomesMaturity");
    expect(read("components/v2/mission-page.tsx")).toContain("shownFigure(");
    expect(read("components/v2/crew-page.tsx")).toContain("shownFigure(");
  });

  it("Today reads the brand's economics pair and decides Learning from it", () => {
    const today = read("components/v2/today-page.tsx");
    expect(today).toContain("costEconomics.maturity");
    expect(today).not.toContain("scopeIsLearning");
  });

  it("the audience tables read each row's own pairs through ONE model", () => {
    const model = read("lib/audience-table-model.ts");
    expect(model).toContain("stats.metrics.maturity");
    expect(model).toContain("stats.projection?.maturity");
    expect(read("components/v2/audiences-table.tsx")).toContain("audienceFigure(");
  });

  it("the campaign Workflows tab reads the ladder's pairs, grid and list alike", () => {
    const page = read("components/workflows/campaign-workflows-page.tsx");
    expect(page).toContain("buildMatrixCellIndex(matrixRows, basis)");
    expect(page).toContain("ladderRowsForScope(ladderQ.data, scope, basis)");
    expect(page).toContain("figures.learning ?");
    expect(page).toContain("cell?.learning");
  });
});

describe("LearningTag", () => {
  const src = read("components/learning-tag.tsx");

  it("wears the charter's TERTIARY, the one accent every campaign surface reads in", () => {
    // Owner-decided: a campaign's pages read in one colour, and this tag is the one a
    // reader meets most often on them. All three classes are remapped in globals.css.
    for (const cls of ["bg-orange-50", "text-orange-600", "border-orange-200"]) {
      expect(src).toContain(cls);
    }
    // Green and red are VERDICTS, never accents — the tag says nothing went wrong.
    expect(src).not.toMatch(/(bg|text|border)-(green|red)-/);
    expect(src).not.toMatch(/bg-(violet|sky|teal|rose|lime)-/);
  });

  it("rotates to the BRAND's tertiary, so all three layers move together", () => {
    // Owner-decided: a customer's dashboard says "learning" in THEIR tertiary, not
    // ours. `tone-tile` is the opt-in, and the fill, the text and the border each
    // need a rotation rule or the pill renders two hues at once.
    expect(src).toContain("tone-tile");
    const css = read("app/globals.css");
    for (const sel of [
      ".tone-tile.bg-orange-50",
      ".tone-tile.text-orange-600",
      ".tone-tile.border-orange-200",
    ]) {
      expect(css).toContain(`:root[data-brand-tint] ${sel}`);
      expect(css).toContain(`html.dark:root[data-brand-tint] ${sel}`);
    }
  });

  it("carries a full-perimeter border, never a side accent", () => {
    expect(src).toContain("rounded-full border px-2");
    expect(src).toContain("border-orange-200");
    expect(src).toContain("border-gray-200");
    expect(src).not.toMatch(/border-(left|right|top)|border-l-|border-r-|border-t-/);
  });

  it("reads Paused in the pause grey when the campaign behind it is stopped", () => {
    // Same word and same tint as the status pill and the controls roll-up
    // (`bg-gray-100 text-gray-500 border-gray-200`), so one campaign is never
    // described two ways on one screen. `Learning` on a stopped campaign states a
    // process that is not running.
    expect(src).toContain('paused ? "Paused" : "Learning"');
    for (const cls of ["bg-gray-100", "text-gray-500", "border-gray-200"]) {
      expect(src).toContain(cls);
    }
    // A VERDICT never rotates with the brand hue — `tone-tile` stays on the tertiary
    // branch only.
    expect(src).toContain("tone-tile border-orange-200");
    expect(src).not.toMatch(/tone-tile[^"]*gray/);
    // Its own reason, not the learning one.
    expect(src).toContain("PAUSED_NOTE");
  });

  it("explains itself through the shared InfoTooltip, never a native title", () => {
    expect(src).toContain("InfoTooltip");
    expect(src).not.toContain("title=");
  });
});

describe("a PAUSED campaign says so where it would have said Learning", () => {
  it("the return chart's tag reads the paused flag", () => {
    const chart = read("components/revenue/roi-trend-card.tsx");
    expect(chart).toContain("<LearningTag paused={paused} />");
  });
});

describe("LearningTag tone — which of the brand's accents a surface states", () => {
  const src = read("components/learning-tag.tsx");

  it("defaults to the TERTIARY, so a surface that states nothing is unchanged", () => {
    // The context's default is what every brand / offer / campaign Overview keeps
    // reading. A new tone must never repaint a surface nobody opted in.
    expect(src).toContain('createContext<LearningTone>("tertiary")');
  });

  it("states PRIMARY through the brand ramp, never a literal charter hex", () => {
    // `:root[data-brand-tint]` re-declares the whole `--color-brand-*` ramp at the
    // brand hue, so these rotate for free — an arbitrary-value charter hex would be
    // the one control that stays blue on a tinted dashboard.
    expect(src).toContain("border-brand-200 bg-brand-50 text-brand-600");
    expect(src).not.toMatch(/#[0-9a-fA-F]{6}/);
    // No `tone-tile` on the primary branch: that rotation is for the categorical
    // purple/indigo/blue/orange set, and adding it here would read as load-bearing.
    // Asserted on the class STRING, not file-wide — the module's own doc comment
    // explains why the primary needs no tile, and a loose regex trips on that.
    expect(src).not.toContain('"tone-tile border-brand');
  });

  it("keeps the primary tone legible on the dark surface, tinted AND untinted", () => {
    // Same gap that has bitten purple, green/red and orange in turn: a fill remapped
    // while the text and border beside it were not.
    const css = read("app/globals.css");
    for (const cls of [".bg-brand-50", ".text-brand-600", ".border-brand-200"]) {
      expect(css).toContain(`html.dark ${cls}`);
      expect(css).toContain(`html.dark[data-brand-tint] ${cls}`);
    }
  });
});

// The two chart cards on a campaign's Overview each print a headline beside a curve. The
// headline is THE figure, so it reads the served mature one with its verdict, the same the
// stat row states, never a point of a series (the conversion curve is to date).
describe("the chart headlines state the served mature figure, never the curve's last point", () => {
  const leg = (overrides: Record<string, unknown> = {}) => ({
    legKey: "start_to_conversation",
    durationDays: 21,
    outcomesRequired: 1,
    outcomeSignal: "positiveReply",
    source: "measured",
    flash: { spentUsd: 612.5, contacted: 4210, outcomes: 9, costPerOutcomeUsd: 68.06, conversionRatePct: 0.21 },
    mature: { spentUsd: 402.2, contacted: 2890, outcomes: 7, costPerOutcomeUsd: 57.46, conversionRatePct: 0.24 },
    isMature: true,
    ...overrides,
  });
  const body = (extra: Record<string, unknown>) => ({
    featureSlug: "sales-cold-email-outreach",
    headline: { totalPipelineUsd: 100 },
    costEconomics: {
      maturity: { flash: null, mature: null, isMature: null },
      committedCostUsd: 612.5,
      costOfAcquisitionPct: null,
      roiMultiple: null,
      costPerAcquisitionUsd: null,
    },
    timeSeries: [],
    organizations: [],
    events: [],
    attributedOutcomes: [],
    leads: [],
    ...extra,
  });

  it("parses the scope's maturity and each leg's figures on both bases", async () => {
    const { parseFeatureRevenue } = await import("../src/lib/revenue-parse");
    const parsed = parseFeatureRevenue(body({ maturity: { isMature: true, legs: [leg()] } }), "test");
    expect(parsed.maturity?.isMature).toBe(true);
    expect(parsed.maturity?.legs[0].mature?.costPerOutcomeUsd).toBe(57.46);
    // absent and null both read as "not read": no figure, no tag
    expect(parseFeatureRevenue(body({}), "test").maturity).toBeNull();
    expect(parseFeatureRevenue(body({ maturity: null }), "test").maturity).toBeNull();
    // a leg missing its verdict is shape rot, and fails loud
    expect(() =>
      parseFeatureRevenue(body({ maturity: { isMature: true, legs: [leg({ isMature: undefined })] } }), "test"),
    ).toThrow();
  });

  it("a body with NO pair parses and states no figure: optional as the producer declares it", async () => {
    // Measured on the deploy that shipped the pairs: the first reads of four scopes came
    // back from pre-deploy cached snapshots without them. Absent -> dash, never legacy.
    const { parseFeatureRevenue } = await import("../src/lib/revenue-parse");
    const b = body({});
    delete (b.costEconomics as Record<string, unknown>).maturity;
    const parsed = parseFeatureRevenue(b, "test");
    expect(parsed.costEconomics.maturity).toBeNull();
    expect(shownFigure(parsed.costEconomics.maturity, (h) => h.roiMultiple, "mature")).toEqual({ value: null, learning: false });
  });

  it("the Learning verdict on a leg follows the served pair, never a count here", () => {
    const shown = shownFigure(leg({ isMature: false }) as MaturityPair<{ costPerOutcomeUsd: number | null }>, (h) => h.costPerOutcomeUsd, "mature");
    expect(shown).toEqual({ value: null, learning: true });
    const staff = shownFigure(leg({ isMature: false }) as MaturityPair<{ costPerOutcomeUsd: number | null }>, (h) => h.costPerOutcomeUsd, "flash");
    expect(staff).toEqual({ value: 68.06, learning: false });
  });
});

describe("a ladder whose mature cut failed says so", () => {
  it("the campaign Workflows page states it rather than showing a silent blank grid", () => {
    const page = read("components/workflows/campaign-workflows-page.tsx");
    expect(page).toContain("ladderQ.data?.maturity?.measured === false");
    expect(page).toContain("We could not read the settled prices for this campaign just now");
  });
});
