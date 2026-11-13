import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isMessageReported,
  editedAgainstDraft,
  editedDraftedKeys,
  messageWrittenUnit,
  offerFieldsDraftedUnit,
  sameFieldValue,
} from "../src/lib/unit-reports";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("SCRIPT-VALUE-RATING-1113: the Unit is named as the ledger names it", () => {
  it("an offer draft = offer_fields_drafted / brand-service / the offer (the brand before any offer)", () => {
    expect(offerFieldsDraftedUnit("b1", "o1")).toEqual({ outcomeKey: "offer_fields_drafted", subjectService: "brand-service", subjectId: "o1" });
    expect(offerFieldsDraftedUnit("b1", null).subjectId).toBe("b1");
  });

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

describe("an edit of a value WE drafted", () => {
  const before = {
    dreamOutcome: { value: "Ten meetings a month", provenance: "suggested" },
    socialProof: { value: ["Acme grew 3x"], provenance: "suggested" },
    guarantee: { value: "Typed by the client", provenance: "confirmed" },
    timeDelay: { value: null, provenance: "suggested" },
  };

  it("counts a changed suggested field", () => {
    expect(editedDraftedKeys(before, { dreamOutcome: "Twenty meetings a month" })).toEqual(["dreamOutcome"]);
  });

  it("a save that changes nothing sends none (list vs lines, whitespace)", () => {
    expect(editedDraftedKeys(before, { dreamOutcome: " Ten meetings a month ", socialProof: "Acme grew 3x\n" })).toEqual([]);
  });

  it("a value the client typed (confirmed) or an empty draft is never ours", () => {
    expect(editedDraftedKeys(before, { guarantee: "Changed again", timeDelay: "Two weeks" })).toEqual([]);
  });

  it("onboarding compares against the draft it holds", () => {
    expect(editedAgainstDraft({ dreamOutcome: "A", guarantee: "" }, { dreamOutcome: "B", guarantee: "Mine" })).toEqual(["dreamOutcome"]);
    expect(editedAgainstDraft({ socialProof: "x\ny" }, { socialProof: ["x", "y"] })).toEqual([]);
    expect(sameFieldValue(["a"], "a")).toBe(true);
  });
});

describe("call sites", () => {
  it("the Offer page, the give lists and the onboarding send an edited report after the save", () => {
    expect(src("src/components/settings/brand-offer-card.tsx")).toContain('sendReport(unit, "edited"');
    expect(src("src/components/v2/offer-give-lists.tsx")).toContain('sendReport(unit, "edited"');
    const gs = src("src/components/v2/get-started/get-started.tsx");
    expect(gs.match(/reportDraftEdits\(o\.offerId/g)?.length).toBe(2);
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
