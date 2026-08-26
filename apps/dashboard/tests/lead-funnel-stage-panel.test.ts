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
