import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CrmAttributionSchema,
  attributionLabel,
  crmEvidenceLabel,
  evidencedSteps,
  ruleReasonLabel,
} from "../src/lib/crm-attribution";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Shape served by lead-service GET /orgs/leads/:id/crm-attribution (#575).
const body = {
  leadCampaignId: "11111111-1111-4111-8111-111111111111",
  leadId: "22222222-2222-4222-8222-222222222222",
  brandId: "75d7e3e8-6926-4f85-a557-976895400666",
  steps: [
    {
      step: "meeting_booked",
      evidence: null,
      rule: null,
      statement: null,
      causedByOutreach: null,
      basis: null,
    },
    {
      step: "meeting_attended",
      evidence: {
        crmContactId: "c1",
        crmStep: "meeting_not_held",
        occurredAt: null,
        dateBasis: null,
        source: "stage_entry",
        sourceId: "o1",
        valueCents: null,
      },
      rule: { causedByOutreach: null, reason: "event_undated", firstDeliveredAt: "2026-06-01T00:00:00Z" },
      statement: null,
      causedByOutreach: null,
      basis: "rule",
    },
    {
      step: "sale",
      evidence: {
        crmContactId: "c1",
        crmStep: "sale",
        occurredAt: "2026-07-13T17:40:46.065Z",
        dateBasis: "status_change",
        source: "won_status",
        sourceId: "o2",
        valueCents: 50000,
      },
      rule: { causedByOutreach: true, reason: "after_first_delivery", firstDeliveredAt: "2026-06-01T00:00:00Z" },
      statement: { causedByOutreach: false, note: null, statedByUserId: "u", statedAt: "2026-09-24T12:00:00Z" },
      causedByOutreach: false,
      basis: "person",
    },
  ],
};

describe("crm attribution read", () => {
  it("parses lead-service's body", () => {
    expect(CrmAttributionSchema.safeParse(body).success).toBe(true);
  });

  it("lists only the steps their CRM evidences", () => {
    const d = CrmAttributionSchema.parse(body);
    expect(evidencedSteps(d).map((s) => s.step)).toEqual(["meeting_attended", "sale"]);
    expect(evidencedSteps(undefined)).toEqual([]);
  });

  it("names a never as what it is", () => {
    const d = CrmAttributionSchema.parse(body);
    expect(crmEvidenceLabel(d.steps[1])).toBe("Meeting did not happen");
    expect(crmEvidenceLabel(d.steps[2])).toBe("Close won");
  });

  it("reads null as undecided, never as not ours", () => {
    expect(attributionLabel(null)).toBe("Undecided");
    expect(attributionLabel(true)).toBe("Ours");
    expect(attributionLabel(false)).toBe("Not ours");
  });

  it("states the rule's reason, an unknown one verbatim", () => {
    expect(ruleReasonLabel("event_undated")).toMatch(/do not claim/);
    expect(ruleReasonLabel("something_new")).toBe("something_new");
    expect(ruleReasonLabel(null)).toBeNull();
  });
});

describe("crm attribution call sites", () => {
  it("one card, mounted in the lead panel and in the CRM Merged panel", () => {
    expect(src("src/components/audiences/engaged-leads-page.tsx")).toContain(
      "<CrmAttributionCard leadRowId={selectedLead.id} brandId={brandId} />",
    );
    const merged = src("src/components/crm/crm-merged-page.tsx");
    expect(merged).toContain("<CrmAttributionCard leadRowId={lead.leadCampaignId} brandId={brandId} />");
    expect(merged).toContain('p.state === "paired"');
  });

  it("the card never renders an error body verbatim", () => {
    const card = src("src/components/crm/crm-attribution-card.tsx");
    expect(card).not.toContain("err.message");
    expect(card).not.toContain("—");
  });
});
