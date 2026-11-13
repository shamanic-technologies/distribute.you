import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isMessageReported,
  draftedAfterSave,
  draftedEdits,
  draftUnitOf,
  messageWrittenUnit,
  sameFieldValue,
} from "../src/lib/unit-reports";
import { BrandUserFieldsResponseSchema } from "../src/lib/api";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("SCRIPT-VALUE-RATING-1113: the Unit is named as the ledger names it", () => {
  it("a message we wrote = message_written / lead-service / the lead, at its send time", () => {
    expect(messageWrittenUnit("l1", "2026-11-13T10:00:00.000Z")).toEqual({
      outcomeKey: "message_written",
      subjectService: "lead-service",
      subjectId: "l1",
      unitAt: "2026-11-13T10:00:00.000Z",
    });
    expect(messageWrittenUnit("l1", null)).not.toHaveProperty("unitAt");
  });
});

describe("an edit of a value WE drafted names the draft's own Unit", () => {
  const offerUnit = { outcomeKey: "offer_fields_drafted", subjectService: "brand-service", subjectId: "o1", unitAt: "2026-11-13T09:00:00.000Z", runId: "run-1" };
  const brandUnit = { outcomeKey: "brand_fields_drafted", subjectService: "brand-service", subjectId: "b1", unitAt: "2026-11-13T08:00:00.000Z", runId: "run-0" };
  const before = {
    dreamOutcome: { value: "Ten meetings a month", provenance: "suggested", stillOurDraft: true, draftUnit: offerUnit },
    socialProof: { value: ["Acme grew 3x"], provenance: "confirmed", stillOurDraft: true, draftUnit: offerUnit },
    companyOverview: { value: "We sell meetings", provenance: "suggested", stillOurDraft: true, draftUnit: brandUnit },
    guarantee: { value: "Typed by the client", provenance: "confirmed", stillOurDraft: false, draftUnit: null },
    urgency: { value: "Drafted before the Unit existed", provenance: "suggested", stillOurDraft: true, draftUnit: null },
    timeDelay: { value: null, provenance: "suggested", stillOurDraft: true, draftUnit: offerUnit },
  };
  const named = (u: typeof offerUnit) => ({ outcomeKey: u.outcomeKey, subjectService: u.subjectService, subjectId: u.subjectId, unitAt: u.unitAt });

  it("a changed field still our draft = ONE report naming its draftUnit, unitAt included", () => {
    expect(draftedEdits(before, { dreamOutcome: "Twenty meetings a month" })).toEqual([{ unit: named(offerUnit), keys: ["dreamOutcome"] }]);
  });

  it("a confirmed value that is still our text counts too (provenance is not the test)", () => {
    expect(draftedEdits(before, { socialProof: ["Acme grew 5x"] })).toEqual([{ unit: named(offerUnit), keys: ["socialProof"] }]);
  });

  it("fields of one draft share one report; another draft gets its own", () => {
    expect(draftedEdits(before, { dreamOutcome: "B", socialProof: ["C"], companyOverview: "We sell revenue" })).toEqual([
      { unit: named(offerUnit), keys: ["dreamOutcome", "socialProof"] },
      { unit: named(brandUnit), keys: ["companyOverview"] },
    ]);
  });

  it("a brand-level drafted field names brand_fields_drafted / the brand", () => {
    const [edit] = draftedEdits(before, { companyOverview: "We sell revenue" });
    expect(edit.unit).toEqual({ outcomeKey: "brand_fields_drafted", subjectService: "brand-service", subjectId: "b1", unitAt: "2026-11-13T08:00:00.000Z" });
  });

  it("a save that changes nothing sends none (list vs lines, whitespace)", () => {
    expect(draftedEdits(before, { dreamOutcome: " Ten meetings a month ", socialProof: "Acme grew 3x\n", companyOverview: "We sell meetings" })).toEqual([]);
  });

  it("the client's own value, a draft naming no Unit, or an empty draft sends none", () => {
    expect(draftedEdits(before, { guarantee: "Changed again", urgency: "Now", timeDelay: "Two weeks", unknownKey: "x" })).toEqual([]);
    expect(draftedEdits(undefined, { dreamOutcome: "x" })).toEqual([]);
    expect(draftedEdits({ a: { value: "x", draftUnit: offerUnit } }, { a: "y" })).toEqual([]);
  });

  it("a draftUnit missing a part names no Unit", () => {
    expect(draftUnitOf({ outcomeKey: "offer_fields_drafted", subjectService: "brand-service", subjectId: "o1" })).toBeNull();
    expect(draftUnitOf(null)).toBeNull();
    expect(draftUnitOf(offerUnit)).toMatchObject(named(offerUnit));
    expect(sameFieldValue(["a"], "a")).toBe(true);
  });

  it("onboarding: once changed, a value is the visitor's own, so the step confirmed again reports nothing", () => {
    const held = { dreamOutcome: before.dreamOutcome, socialProof: before.socialProof };
    const sent = { dreamOutcome: "Twenty meetings a month", socialProof: "Acme grew 3x" };
    expect(draftedEdits(held, sent)).toHaveLength(1);
    const after = draftedAfterSave(held, sent);
    expect(draftedEdits(after, sent)).toEqual([]);
    expect(draftedEdits(after, { dreamOutcome: "Thirty" })).toEqual([]);
    // The untouched one is still ours: changing it later reports.
    expect(draftedEdits(after, { socialProof: "Acme grew 9x" })).toEqual([{ unit: named(offerUnit), keys: ["socialProof"] }]);
  });

  it("the user-fields read keeps the draft facts, and a body without them still parses", () => {
    const parsed = BrandUserFieldsResponseSchema.parse({
      fields: {
        dreamOutcome: { value: "x", provenance: "confirmed", stillOurDraft: true, draftUnit: offerUnit },
        services: { value: ["y"], provenance: "confirmed" },
        urgency: { value: "z", provenance: "suggested", stillOurDraft: true, draftUnit: { outcomeKey: "offer_fields_drafted" } },
      },
    });
    expect(parsed.fields.dreamOutcome.stillOurDraft).toBe(true);
    expect(parsed.fields.dreamOutcome.draftUnit).toMatchObject(named(offerUnit));
    expect(parsed.fields.services.stillOurDraft).toBe(false);
    expect(parsed.fields.services.draftUnit).toBeNull();
    expect(parsed.fields.urgency.draftUnit).toBeNull();
  });
});

describe("call sites", () => {
  it("the Offer page, the give lists and the onboarding send an edited report after the save", () => {
    expect(src("src/components/settings/brand-offer-card.tsx")).toContain('reportDraftEdits("offer fields", userFieldsData?.fields');
    expect(src("src/components/v2/offer-give-lists.tsx")).toContain('reportDraftEdits("give lists", fields.data?.fields');
    const gs = src("src/components/v2/get-started/get-started.tsx");
    // The client value, the offer points and the give lists.
    expect(gs.match(/reportDraftEdits\(o\.offerId/g)?.length).toBe(3);
    expect(gs).toContain("draftUnitOf(r.drafts?.[key]?.draftUnit)");
    const hook = src("src/lib/use-unit-report.ts");
    expect(hook).toContain('sendReport(edit.unit, "edited"');
  });

  it("no surface builds a draft's Unit itself: it is the one brand-service serves", () => {
    for (const f of ["src/lib/unit-reports.ts", "src/lib/use-unit-report.ts", "src/components/settings/brand-offer-card.tsx", "src/components/v2/offer-give-lists.tsx", "src/components/v2/get-started/get-started.tsx"]) {
      expect(src(f)).not.toMatch(/outcomeKey: "(offer|brand)_fields_drafted"/);
      expect(src(f)).not.toContain("offerFieldsDraftedUnit");
    }
  });

  it("the Unibox offers Report only on a message we wrote", () => {
    const c = src("src/components/v2/integrations-conversations.tsx");
    expect(c).toContain("<ReportMessage leadId={leadId} sentAt={item.at ?? null} />");
    expect(c).toContain('item.direction === "outbound" && leadId && writtenByForRow(');
  });

  it("staff mode sends nothing", () => {
    const h = src("src/lib/use-unit-report.ts");
    expect(h.indexOf("if (staffMode)")).toBeGreaterThan(-1);
    expect(h.indexOf("if (staffMode)")).toBeLessThan(h.indexOf("return reportUnit("));
  });

  it("no thumbs up, no star", () => {
    const r = src("src/components/v2/report-message.tsx");
    expect(r).not.toMatch(/thumb|star|Helpful|Good job/i);
  });
});

describe("the Reported mark comes back after a reload", () => {
  const row = (unitAt: string | null, kind = "reported") => ({ id: "r", outcomeKey: "message_written", subjectService: "lead-service", subjectId: "l1", kind, unitAt, reportedAt: "2026-11-13T12:00:00.000Z" });
  it("marks the message whose send time the report names, same instant whatever the spelling", () => {
    expect(isMessageReported([row("2026-11-12T10:02:00Z")], "2026-11-12T10:02:00.000Z")).toBe(true);
    expect(isMessageReported([row("2026-11-12T10:02:00Z")], "2026-11-12T11:00:00.000Z")).toBe(false);
  });
  it("a report naming no message, or an edit, marks none", () => {
    expect(isMessageReported([row(null)], "2026-11-12T10:02:00.000Z")).toBe(false);
    expect(isMessageReported([row("2026-11-12T10:02:00Z", "edited")], "2026-11-12T10:02:00.000Z")).toBe(false);
    expect(isMessageReported(undefined, "2026-11-12T10:02:00.000Z")).toBe(false);
  });
  it("the button reads the served list", () => {
    const r = src("src/components/v2/report-message.tsx");
    expect(r).toContain('if (state === "sent" || servedReported)');
    expect(r).toContain("listUnitReports({ subjectService: \"lead-service\", subjectId: leadId, outcomeKey: \"message_written\" })");
  });
});
