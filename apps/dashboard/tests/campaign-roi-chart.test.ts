import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * ROI-CONSISTENCY-1103 (owner 2026-11-03): a return exists only where a value LANDS. The
 * pipeline-based "Return over time" curve is retired from the campaign page and Today; the
 * campaign's ROI tile reads the served EXPECTED return and the REALIZED line only.
 */
const page = fs.readFileSync(path.join(__dirname, "../src/components/v2/campaign-page.tsx"), "utf-8");

describe("campaign ROI tile (ROI-CONSISTENCY-1103)", () => {
  it("draws no return curve and reads expected + realized only", () => {
    expect(fs.existsSync(path.join(__dirname, "../src/components/v2/campaign-roi-chart.tsx"))).toBe(false);
    expect(page).not.toContain("CampaignRoiChart");
    expect(page).not.toContain("shownReturn(");
    const tile = page.slice(page.indexOf("function RoiTile("), page.indexOf("function CampaignOverview("));
    expect(tile).toContain("<ExpectedReturnValue expected={g?.expectedReturn}");
    expect(tile).toContain("<RealizedReturnLine realized={g?.realizedReturn}");
  });
});

/**
 * Owner 2026-10-08: Today is the offer's ROI page. It draws the offer's own served
 * `roiHistory` with the same card as the campaign page, and the offer's pipeline by step
 * from features-service `/offers/:offerId/outcomes` (never summed or divided here).
 */
describe("Today: one row of cards per campaign Target (LEAD-GENERIC-1106)", () => {
  const today = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-page.tsx"), "utf-8");
  const targets = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-targets.tsx"), "utf-8");

  it("draws no pipeline-based return curve (ROI-CONSISTENCY-1103)", () => {
    expect(today).not.toContain("<RoiHistoryCard");
    expect(today).not.toContain("roiHistory");
  });

  it("names no sales-funnel outcome in JSX: the Target rows wear the served label (owner 2026-11-06)", () => {
    expect(today).toContain("<TodayTargets orgId={orgId} brandId={brandId} offerId={selectedOfferId} />");
    for (const word of ["Hot leads", "Lost leads", "Customers won", "Positive replies", "Website visits", ">Meetings<"]) {
      expect(today).not.toContain(word);
      expect(targets).not.toContain(word);
    }
    expect(targets).toContain("row.target?.label");
    expect(targets).toContain("<StepMark stepKey={row.target.key} />");
  });

  it("prints served figures only: count, $ each, measured return, past then projection", () => {
    expect(targets).toContain("row.outcomesToDate");
    expect(targets).toContain("row.costPerOutcomeUsd");
    expect(targets).toContain("row.measuredReturn.roiMultiple");
    expect(targets).toContain("row.past.map((p) => p.cumulativeOutcomes)");
    expect(targets).toContain("row.projection.daily.map((d) => d.cumulativeExpectedOutcomes)");
    expect(targets).toContain("nextExpectedWords(row.projection.nextExpectedInHours)");
    expect(targets).not.toContain("reduce(");
    expect(targets).not.toMatch(/spentUsd\s*\/|\/\s*row\.outcomesToDate/);
  });

  it("the panel explains the served legs and edits each rate at brand level", () => {
    const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
    expect(panel).toContain("why.legs.map(");
    expect(panel).toContain("legRateFor(rates.data?.legs ?? [], l.legKey)");
    expect(panel).toContain("<InlineRate");
    expect(panel).toContain("await stateBrandLegRates(brandId,");
    expect(panel).toContain("invalidateConversionRates(qc);");
    expect(panel).not.toMatch(/probabilityPct\s*\*|lifetimeRevenueUsd\s*\*|recipientsReached\s*-/);
  });
});

describe("Today's Campaigns state each campaign's caps, no retired per-campaign totals", () => {
  const today = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-page.tsx"), "utf-8");
  it("a funnel campaign line carries its caps; the per-campaign budget totals are gone", () => {
    expect(today).toContain("<FunnelCampaignLine key={f.id}");
    expect(today).not.toContain("BudgetTotals");
    expect(today).not.toContain("getOfferCampaignBudgets");
    expect(today).not.toMatch(/items\.reduce\(/);
  });
});

/**
 * Owner 2026-10-08: a step's panel shows who stands on it in three groups (ours, ours
 * lost, not ours), served by features-service; a lead's panel changes its status with
 * lead-service's per-lead step statements, cost asked, keyed on the campaign row id.
 */
describe("Today panel: people by group and the lead status change", () => {
  const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
  it("renders the three served groups, the ours ones as the big cards", () => {
    const ours = panel.slice(panel.indexOf("{people.ours.leads.map("), panel.indexOf("{people.lost.count > 0"));
    expect(ours.length).toBeGreaterThan(0);
    expect(ours).toContain('size="hero"');
    expect(panel).toContain('<LeadCard key={l.leadId} lead={l} size="lost"');
    expect(panel).toContain('<LeadCard key={l.leadId} lead={l} size="compact"');
  });
  it("writes a status through the step statement on the served row id, cost asked", () => {
    expect(panel).toContain("const rowId = lead.campaignLeadId ?? null;");
    expect(panel).toContain("useSetAnyLeadStepStatement()");
    expect(panel).toContain("<StageStatementForm");
    expect(panel).toContain("<CloseWonForm");
  });
});

/**
 * Owner 2026-10-08: a person card in a step's panel opens that person's lead view, like a
 * Hot leads row, with a back arrow top left returning to the list.
 */
describe("Today panel: a step's person opens its lead view, with a way back", () => {
  const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
  it("every list card opens the person", () => {
    expect(panel).toContain('onOpen={() => onOpenPerson({ lead: asLead(l, step.step), group: "hot", meta })}');
    expect(panel).toContain('onOpenPerson({ lead: asLostLead(l, step.step), group: "lost"');
    expect(panel).toContain("asLead(l, CONTACTED_STEP)");
  });
  it("the header carries a back arrow while a person is open, Esc goes back first", () => {
    expect(panel).toContain('onClick={() => setPerson(null)} aria-label="Back"');
    expect(panel).toContain("if (person) setPerson(null);");
    expect(panel).toContain("useEffect(() => setPerson(null), [target]);");
  });
});

/**
 * Owner 2026-10-08: a paid client's lead view edits the client's value and its status.
 * lead-service's sale statement: restated with its date, cost, cause and note as read,
 * or withdrawn. Only a win a person stated is editable.
 */
describe("Today panel: a paid client edits its value and status", () => {
  const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
  const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");
  it("reads the sale statement and edits only a person's own", () => {
    expect(panel).toContain('lead.step.key === "paid_client" ? (\n        <ClientStatus lead={lead} />');
    expect(panel).toContain('const editable = sale?.state === "outcome" && sale.origin === "stated" && sale.source === "manual";');
    expect(api).toContain("export async function getLeadStepStatements(");
    expect(api).toContain("`/leads/${leadRowId}/step-statements/${step}`, { token, method: \"DELETE\" }");
  });
  it("a client sits in the same Update this lead row, its own answers prefilled", () => {
    const client = panel.slice(panel.indexOf("function ClientStatus("), panel.indexOf("export function LeadCard("));
    expect(client).toContain('<p className="k-label mb-2">Update this lead</p>');
    expect(client).toContain("Mark as won");
    expect(client).toContain("Won&apos;t happen");
    expect(client).toContain("prefillCause={sale.causedByOutreach}");
    expect(client).toContain("occurredAt: sale.at");
    expect(client).not.toContain("InlineMoney");
    expect(client).not.toContain('role="menu"');
  });
  it("Won't happen takes the win back, then states the never", () => {
    const client = panel.slice(panel.indexOf("function ClientStatus("), panel.indexOf("export function LeadCard("));
    expect(client.indexOf('withdraw.mutateAsync({ leadRowId: rowId, step: "sale" })')).toBeGreaterThan(0);
    expect(client.indexOf('kind: "never", costCents')).toBeGreaterThan(client.indexOf('withdraw.mutateAsync({ leadRowId: rowId, step: "sale" })'));
  });
});
