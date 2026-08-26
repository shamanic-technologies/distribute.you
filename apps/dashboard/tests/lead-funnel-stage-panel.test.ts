import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const PAGE = read("src/components/audiences/engaged-leads-page.tsx");
const SECTION = read("src/components/leads/lead-funnel-stage-section.tsx");
const HOOK = read("src/lib/use-lead-step-statements.ts");

describe("lead funnel stage panel", () => {
  it("keys the control set on the campaign's FUNNEL, never on a goal", () => {
    // `sales_meetings` covers both meeting funnels, so a goal cannot say whether the
    // chain starts at a reply or at a website visit — the exact distinction this panel
    // records. The campaign has stated its funnelKey since #3344.
    const slice = PAGE.slice(PAGE.indexOf("const panelFunnel ="), PAGE.indexOf("const onSetStage ="));
    expect(slice).toContain("activeFunnelKeys[0]");
    expect(slice).toContain("leadFunnelStages(panelFunnel.key)");
    expect(slice).not.toContain("optimizationGoal");
    expect(slice).not.toContain("stepsFor(");
  });

  it("mounts ONLY under a campaign, where exactly one funnel is sold", () => {
    expect(PAGE).toContain("{campaignId && panelFunnel && (");
  });

  it("states the lead by its ROW id, which is what carries the campaign", () => {
    // `lead.leadId` is the person and is brand-grained; the leads_campaigns row is what
    // makes a statement attributable to the campaign it was made on.
    const slice = PAGE.slice(PAGE.indexOf("useLeadStepStatements("), PAGE.indexOf("const setStage ="));
    expect(slice).toContain("selectedLead.id");
    expect(slice).not.toContain("selectedLead.leadId");
  });

  it("renders a producer refusal through its own helper, never err.message", () => {
    // apiCall sets `message` to the whole downstream body verbatim — rendering it puts
    // a JSON blob in front of a customer and destroys the code consumers branch on.
    expect(PAGE).toContain("leadStepErrorMessage(err)");
    const slice = PAGE.slice(PAGE.indexOf("const onSetStage ="), PAGE.indexOf("const onSetStage =") + 1400);
    expect(slice).not.toContain("err.message");
  });

  it("offers NO control on a stage lead-service cannot record", () => {
    // A reply belongs to the message and a visit to the delivery layer. A button that
    // cannot write is worse than no button.
    expect(SECTION).toContain("isWritableStage(stage.key)");
    expect(SECTION).toContain("writable ? (");
  });

  it("never offers a retraction, because the producer has no write back to pending", () => {
    // The old shape let a click on the active button clear it. There is no such route;
    // a statement is corrected by making the other one.
    expect(SECTION).not.toContain('=== "outcome" ? "pending"');
    expect(SECTION).not.toContain('=== "never" ? "pending"');
    expect(SECTION).toContain('disabled={locked || state === "outcome"}');
  });

  it("re-reads after a write instead of reconstructing the producer's answer", () => {
    // lead-service decides more than the field written: an outcome can supersede an
    // earlier `never`, and it stamps source, user and time.
    expect(HOOK).toContain("invalidateQueries");
    expect(HOOK).not.toContain("setQueryData");
  });

  it("invalidates the revenue ROOT, because a statement moves the money at every grain", () => {
    expect(HOOK).toContain('queryKey: ["featureRevenue"]');
  });

  it("does not poll the statements", () => {
    // Nothing else writes them: a statement arrives because somebody in this session
    // made it, and the tracker's own arrivals ride the /revenue join the page polls.
    expect(HOOK).not.toContain("refetchInterval");
  });

  it("carries no em-dash in any user-facing string", () => {
    const strings = SECTION.match(/"[^"\n]{12,}"/g) ?? [];
    for (const s of strings) expect(s).not.toContain("—");
  });
});

describe("stating what a won deal was worth", () => {
  it("asks for the amount instead of sending a sale the producer will refuse", () => {
    // lead-service 400s a sale with no value. Predicting a refusal and asking the
    // question is the honest surface; submitting anyway is not.
    expect(SECTION).toContain("stageRequiresValue(stage.key)");
    expect(SECTION).toContain("setAskingValueFor(stage.key as WritableStageKey)");
  });

  it("cannot submit the amount form until what was typed IS an amount", () => {
    expect(SECTION).toContain("saleValueCentsFrom(raw)");
    expect(SECTION).toContain("disabled={valueCents == null || busy}");
  });

  it("reads the recorded amount back where it was typed", () => {
    expect(SECTION).toContain('data-testid="lead-funnel-stage-value"');
    expect(PAGE).toContain("stageValuesFrom(stepStatements)");
    expect(PAGE).toContain("values={panelValues}");
  });

  it("sends the amount only when the control asked for one", () => {
    // A `never` carries no value and the producer refuses one, so the key is omitted
    // rather than sent empty.
    expect(PAGE).toContain("valueCents === undefined ? { step: key, kind: next }");
  });

  it("leaves every other stage a single click, with no amount in the request", () => {
    expect(SECTION).toContain(': onSet(stage.key as WritableStageKey, "outcome")');
    expect(SECTION).toContain('onClick={() => onSet(stage.key as WritableStageKey, "never")}');
  });
});
