import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { parseLeadStepStatements } from "../src/lib/api";

// A paired lead carries steps its customer's own CRM evidenced. The panel must parse
// them, read them as coming from that CRM, and never offer to withdraw them.

const step = (over: Record<string, unknown>) => ({
  step: "meeting_booked",
  state: "outcome",
  origin: "stated",
  impliedBy: null,
  statedState: "outcome",
  inFunnel: true,
  source: "manual",
  valueCents: null,
  costCents: null,
  note: null,
  statedByUserId: null,
  at: "2026-09-24T10:00:00.000Z",
  ...over,
});

const body = {
  leadCampaignId: "lc-1",
  leadId: "l-1",
  campaignId: "c-1",
  brandId: "b-1",
  funnelKey: "sales_meetings_from_conversation",
  funnelSteps: ["meeting_booked", "meeting_attended", "sale"],
  steps: [
    step({ step: "meeting_booked", source: "crm" }),
    step({ step: "meeting_attended", state: "never", statedState: "never", source: "crm" }),
    step({ step: "sale", source: "manual", costCents: 1000, valueCents: 50000, statedByUserId: "u" }),
  ],
};

describe("step statements with a CRM-evidenced step", () => {
  it("the real parser accepts source 'crm'", () => {
    const parsed = parseLeadStepStatements(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.steps[0].source).toBe("crm");
  });

  it("does not throw on a source value this app has not heard of yet", () => {
    const parsed = parseLeadStepStatements({ ...body, steps: [step({ source: "something_new" })] });
    expect(parsed.success).toBe(true);
  });

  const hook = readFileSync(join(__dirname, "../src/lib/use-lead-step-statements.ts"), "utf8");
  const panel = readFileSync(join(__dirname, "../src/components/leads/lead-funnel-stage-section.tsx"), "utf8");
  const page = readFileSync(join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"), "utf8");

  it("only a person's statement is withdrawable, so a CRM step never is", () => {
    const fn = hook.slice(hook.indexOf("export function withdrawableStages("), hook.indexOf("export function stageStatesFrom("));
    expect(fn).toContain('if (entry.source !== "manual") continue;');
  });

  it("a CRM step reads as coming from the customer's CRM, as a reading with no control", () => {
    expect(hook).toContain('if (entry.source !== "crm") continue;');
    expect(panel).toContain("From your CRM");
    expect(panel).toContain("isFromCrm ? (");
    expect(page).toContain("fromCrm={panelFromCrm}");
    expect(page).toContain("crmStages(stepStatements)");
  });

  it("the copy carries no em-dash", () => {
    const tip = panel.slice(panel.indexOf("const CRM_TIP ="), panel.indexOf("const CRM_TIP =") + 300);
    expect(tip).not.toContain("—");
  });
});
