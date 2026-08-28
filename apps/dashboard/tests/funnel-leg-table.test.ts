import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

const table = read("components/campaigns/campaigns-table.tsx");
const page = read("components/funnels/funnel-overview-page.tsx");
const identity = read("components/campaigns/campaign-identity.tsx");

/** The file holds BOTH tables — the leg walk and the multi-funnel list — so every
 *  slice is bounded or a guard reads the wrong one and passes on the wrong evidence. */
const legTable = table.slice(
  table.indexOf("function FunnelLegTable("),
  table.indexOf("export function CampaignsTable("),
);
const legCells = table.slice(
  table.indexOf("function LegOutcomeCells("),
  table.indexOf("function FunnelLegTable("),
);

/**
 * The funnel page's table lists the funnel's ARROWS, not our campaigns.
 *
 * These are source-substring guards because the modules import through the `@` alias,
 * which vitest does not resolve here. The two pure modules underneath (`funnel-leg-marks`,
 * `funnel-leg-rows`) carry REAL unit tests — keep them alias-free.
 */
describe("the funnel page's campaigns table walks the funnel's legs", () => {
  it("takes the walk from the PAGE rather than re-reading it", () => {
    // The page already holds this payload for the cards above the table; a second read
    // is how two parts of one screen come to state different counts.
    expect(table).toContain("funnelSteps?: FunnelStepBreakdown | null;");
    const at = page.indexOf("<CampaignsTable");
    expect(at).toBeGreaterThan(-1);
    const call = page.slice(at, page.indexOf("/>", at));
    // The CALL SITE, not just the component: a prop the component honours and the page
    // never passes is the feature entirely absent with the component perfectly correct.
    expect(call).toContain("funnelSteps=");
    expect(call).toContain("data?.funnelSteps");
    expect(call).toContain("funnelKey={rawKey}");
  });

  it("states one row per arrow, whoever performs it", () => {
    expect(table).toContain("buildFunnelLegRows");
    expect(table).toContain("funnelLegs(funnelDef)");
    // The campaign's leg is resolved against the channel catalogue at the render side,
    // because that is where the catalogue lives.
    expect(table).toContain("campaignLegFor(");
    expect(table).toContain("acquisitionChannelForFeatureSlug(row.campaign.featureSlug, channels)");
  });

  it("names an arrow nobody sells us as one the brand does itself", () => {
    // Not a dash: an absent channel reads as a gap, which is a different statement
    // from an arrow the customer works at their own side.
    expect(table).toContain('viaNote="Done by you"');
    expect(identity).toContain("viaNote");
  });

  it("leads a row with the LEG's mark, falling back to the funnel's", () => {
    const at = identity.indexOf("export function CampaignIdentity(");
    expect(at).toBeGreaterThan(-1);
    const cell = identity.slice(at, identity.indexOf("\n}\n", at));
    const legAt = cell.indexOf("<FunnelLegMark");
    const funnelAt = cell.indexOf("<SalesFunnelMark");
    const channelAt = cell.indexOf("<AcquisitionChannelMark");
    // A funnel tile above words naming ONE arrow marks a different thing than it says.
    expect(legAt).toBeGreaterThan(-1);
    // A leg we have not drawn keeps the funnel's mark rather than rendering nothing.
    expect(funnelAt).toBeGreaterThan(legAt);
    expect(channelAt).toBeGreaterThan(funnelAt);
    expect(cell).toContain("funnelLegMarkFor(leg.fromKey, leg.toKey)");
  });

  it("replaces the three projections with the arrow's own three figures", () => {
    expect(legTable.length).toBeGreaterThan(0);
    const body = legTable;
    expect(body).toContain('label="Outcomes"');
    expect(body).toContain('label="$ / Outcome"');
    expect(body).toContain('label="% Conversion"');
    // ROI, % CAC and the pipeline projection are the brand-and-offer question; a single
    // arrow is judged on what it converted and what reaching it cost.
    expect(body).not.toContain('label="ROI"');
    expect(body).not.toContain('label="% CAC"');
    expect(body).not.toContain('label="$ Revenue"');
    // Money already spent and the ceiling that paces it stay: neither is derived from
    // an outcome count.
    expect(body).toContain('label="$ Invested"');
    expect(body).toContain('label="$ Budget"');
  });

  it("renders every figure as a SERVED rung and divides nothing", () => {
    const cells = legCells;
    expect(cells.length).toBeGreaterThan(0);
    expect(cells).toContain("outcomes.toLocaleString");
    expect(cells).toContain("step.costPerReachCents");
    expect(cells).toContain("step.conversionFromPreviousPct");
    // The rate is served, never two counts divided in the browser.
    expect(cells).not.toContain("fromRecipientsReached *");
    expect(cells).not.toMatch(/recipientsReached\s*\/\s*/);
  });

  it("gates the two DERIVED figures together, and never the count", () => {
    const cells = legCells;
    // ONE gate: they divide by the same count, so stating one beside a tag disclaiming
    // the other lets a reader trust a number we just withheld.
    // Keyed on the ROW's own count, so a campaign that produced nothing is not lent
    // the arrow's evidence.
    expect(cells).toContain("isLearning(outcomes ?? undefined)");
    // The COUNT cell carries no gate at all: it is measured whatever its size, and it
    // is what shows the bar being approached. Sliced to that one cell rather than
    // compared by index — the gate now lives in a helper declared above it.
    const countCell = cells.slice(cells.indexOf("<td"), cells.indexOf("</td>"));
    expect(countCell).toContain("outcomes.toLocaleString");
    expect(countCell).not.toContain("LearningTag");
    expect(countCell).not.toContain("thin");
  });

  it("gives a row its OWN outcomes, never the arrow's total under one campaign's name", () => {
    // The rung is funnel-scoped. With two campaigns feeding one step, printing it on
    // both rows lends one campaign the other's evidence: measured in prod, cold email
    // had 18 sales interests and a feedback-request campaign 0, and both read 18.
    expect(legTable).toContain("campaignStepOutcomes(campaign.revenue, leg.toKey)");
    // An arrow no campaign of ours performs has only the rung, which IS its count.
    expect(legTable).toContain("step?.recipientsReached");
  });

  it("withholds the arrow's cost and rate from a row that shares the arrow", () => {
    // There is no per-campaign version of either on the wire, so stating them on both
    // rows says one figure under two names.
    expect(legCells).toContain("sharesArrow ? (");
    expect(legCells).toContain("COLUMN_INFO.sharedArrow");
    expect(table).toContain("Two campaigns feed this step");
    // The shared (i), never a native title — dead on a phone.
    expect(table).not.toContain("title=");
  });

  it("states no money for an arrow no campaign of ours runs", () => {
    const body = legTable;
    // "we have no figure" and "it cost nothing" are different statements.
    expect(body).toContain("campaign ? fmtUsd(campaign.revenue?.committedCostUsd) : \"—\"");
    expect(body).toContain("campaign && campaign.budgetCents != null");
    // A ceiling is a RATE, said the same way the sibling table says it.
    expect(body).toContain("/ day");
  });

  it("keeps the two-column mobile row and the seven-column desktop one", () => {
    const body = legTable;
    expect(body).toContain("w-[70%] md:w-auto");
    // The count is the mobile headline, and it lives in the shared cells.
    expect(legCells).toContain("w-[30%] md:w-auto");
    expect(body).toContain("md:min-w-[760px]");
    // A stale colSpan silently narrows the skeleton row.
    expect(body).toContain("colSpan={7}");
    // One identity column at every width — no mobile-only cell to drift from a
    // desktop one.
    expect(body).not.toContain("md:hidden");
  });

  it("leaves the multi-funnel table exactly as it was", () => {
    // A brand or offer spans several funnels, so there is no single walk and the
    // producer states none. Those surfaces keep the return they are judged on.
    const at = table.indexOf("export function CampaignsTable(");
    const body = table.slice(at);
    expect(body).toContain('label="ROI"');
    expect(body).toContain("funnelSteps !== undefined");
  });

  it("folds the step band away rather than stating a rung in two places", () => {
    // Two surfaces stating one rung's conversion and cost, under their own gates, is
    // how a screen comes to contradict itself.
    expect(existsSync(join(__dirname, "..", "src/components/funnels/funnel-step-band.tsx"))).toBe(
      false,
    );
    expect(page).not.toContain("FunnelStepBand");
  });
});
