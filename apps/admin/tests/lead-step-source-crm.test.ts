import { describe, expect, it } from "vitest";
import { parseLeadStepStatements } from "../src/lib/api";

describe("step statements with a CRM-evidenced step (staff console)", () => {
  it("the real parser accepts source 'crm' and an unknown future value", () => {
    const step = (source: string) => ({
      step: "meeting_booked",
      state: "outcome",
      origin: "stated",
      inFunnel: true,
      source,
      valueCents: null,
      costCents: null,
      note: null,
      statedByUserId: null,
      at: "2026-09-24T10:00:00.000Z",
    });
    for (const source of ["crm", "something_new"]) {
      const parsed = parseLeadStepStatements({
        leadCampaignId: "lc-1",
        leadId: "l-1",
        campaignId: "c-1",
        brandId: "b-1",
        steps: [step(source)],
      });
      expect(parsed.success).toBe(true);
    }
  });
});
