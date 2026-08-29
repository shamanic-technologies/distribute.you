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

  // `Done by you` was one sentence for TWO different parties, and it was wrong on the
  // arrows we work ourselves: a customer reading it on `Sales interest -> Meeting booked`
  // concludes nobody is answering the replies their budget just bought.
  it("names WHO works an arrow nobody sells us, in the channel's own shape", () => {
    expect(table).toContain("statesOperator");
    expect(table).not.toContain("Done by you");
    expect(identity).toContain("funnelLegOperator");
    expect(identity).toContain("funnelLegOperatorLabel");
    // Our own mark for our arrows, the brand's logo for theirs — the same `Via <mark>
    // <name>` line a channel renders, so the two read as one vocabulary.
    expect(identity).toContain("/logo-distribute.svg");
    expect(identity).toContain("<BrandLogo");
    // The brand is read off the open tenant, not passed in: every surface rendering this
    // is already inside that brand and the hook is the one home for its name and logo.
    expect(identity).toContain("useTenantSwitcher()");
  });

  // The status pill on the row already says the campaign is stopped; `Learning` beside it
  // promises a figure that cannot arrive until the customer restarts it, and the
  // shared-arrow pointer sends them to a row that says nothing about why this one is
  // quiet. So a paused row states the same word, in the same grey, as its own pill.
  it("states Paused, not Learning, on a row whose campaign is stopped", () => {
    expect(legCells).toContain("if (paused) return <LearningTag withInfo={false} paused />;");
    // The gate is threaded from the CALL SITE, or the component is correct and the
    // feature is entirely absent.
    expect(table).toContain("paused={campaign ? !isActiveStatus(campaign.campaign.status) : false}");
    expect(table).toContain("paused={!isActiveStatus(row.campaign.status)}");
  });

  // The column heading already says what the rate is a share of, and the rider named the
  // step directly ABOVE this row on a walk that reads top to bottom.
  it("states the conversion rate without restating the step before it", () => {
    expect(legCells).toContain("conversionFromPreviousPct.toFixed(1)");
    expect(legCells).not.toContain("step.fromStep.toLowerCase()");
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
    // The count is the ARROW's rung where the figure is the arrow's across several
    // campaigns, and the ROW's own where the row is alone on its arrow: a campaign that
    // produced nothing is never lent another's evidence, and an arrow that IS measured
    // is never called thin because one of the campaigns feeding it is quiet.
    expect(cells).toContain(
      "isLearning((sharesArrow ? step?.recipientsReached : outcomes) ?? undefined)",
    );
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

  it("states a shared arrow's cost and rate ONCE, on the arrow's lead row", () => {
    // The figure is FUNNEL-scoped on every row — the `$ / Outcome` tooltip says so
    // outright — so a shared arrow does not make it unstateable, only repeatable.
    // Withholding it from every row of the arrow was the earlier shape, and it made a
    // funnel whose two channels both feed its first step read as never measured.
    expect(legCells).toContain("const statesArrowFigures = !sharesArrow || arrowLead;");
    expect(legCells).toContain("if (!statesArrowFigures)");
    expect(legCells).toContain("COLUMN_INFO.sharedArrow");
    // The lead row says whose figure it is; the rest point back at it.
    expect(legCells).toContain("COLUMN_INFO.sharedArrowLead");
    expect(table).toContain("Two campaigns feed this step");
    expect(table).toContain("stated once on the first of them above");
    // The CALL SITE, not only the component: a prop the table never passes leaves the
    // component perfectly correct and the behaviour entirely absent.
    const map = legTable.slice(legTable.indexOf("{rows.map("));
    expect(map).toContain("arrowLead");
    expect(map).toContain("arrowLead={arrowLead}");
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

/**
 * The way over to the funnel's campaign LIST.
 *
 * The table above walks the funnel arrow by arrow, which is the right shape for "where
 * are people falling out" and the wrong one for "what am I running": a campaign carries
 * a return, a status and a budget the walk has no column for. Both surfaces exist, so
 * the page says where the other one is.
 */
describe("see more", () => {
  it("links to this funnel's own campaigns page", () => {
    expect(page).toContain(
      "`${basePath}/funnels/${encodeURIComponent(rawKey)}/campaigns`",
    );
  });

  it("sits on the heading's own row, right-aligned, in the brand's own accent", () => {
    // A link UNDER the table reads as a footnote of its last row rather than as the
    // heading's affordance, and the reader has to scroll the whole walk to find it. The
    // slice runs from the heading to the link, so it fails if the link moves back below
    // the table (measured: the heading precedes `See more` by ~700 chars).
    const headingAt = page.indexOf(
      '<h2 className="font-display text-lg font-bold text-gray-800">Campaigns</h2>',
    );
    const linkAt = page.indexOf("See more");
    expect(headingAt).toBeGreaterThan(-1);
    expect(linkAt).toBeGreaterThan(headingAt);
    const header = page.slice(headingAt - 400, linkAt);
    expect(header).toContain("flex items-center justify-between");
    // The table is BELOW both, so nothing may sit between the heading and the link.
    expect(header).not.toContain("<CampaignsTable");
    // A brand-* ramp step, never a literal charter hex: the ramp rotates with the
    // brand's tint and an arbitrary-value hex cannot.
    expect(header).toContain("text-brand-600");
    expect(header).not.toMatch(/text-\[#/);
  });

  it("states nothing when there is no funnel in the route to link to", () => {
    // A link built from an empty key points at the offer's own funnels index, which is
    // not where the reader asked to go.
    expect(page).toContain("{rawKey && (");
  });
});
