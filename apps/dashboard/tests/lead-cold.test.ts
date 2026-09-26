import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leadWentCold, wentColdReason, WENT_COLD_LABEL } from "../src/lib/lead-cold";

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("leadWentCold reads lead-service's fact and derives nothing", () => {
  it("reads the served object", () => {
    expect(
      leadWentCold({ state: "sales_interest", wentCold: { step: "meeting_booked", since: "2026-06-23T00:00:00Z", afterDays: 30, after: "x" } }),
    ).toEqual({ step: "meeting_booked", since: "2026-06-23T00:00:00Z", afterDays: 30 });
  });
  it("a standing without the field, or with null, is not cold", () => {
    expect(leadWentCold({ state: "contacted" })).toBeNull();
    expect(leadWentCold({ state: "contacted", wentCold: null })).toBeNull();
    expect(leadWentCold(null)).toBeNull();
    expect(leadWentCold(undefined)).toBeNull();
  });
  it("an object with no step is not a fact we can state", () => {
    expect(leadWentCold({ wentCold: { since: "2026-06-23" } })).toBeNull();
  });
  it("missing optional parts read null, never a default", () => {
    expect(leadWentCold({ wentCold: { step: "meeting_attended" } })).toEqual({ step: "meeting_attended", since: null, afterDays: null });
  });
});

describe("wentColdReason says why in the customer's words", () => {
  it("names the step and the window", () => {
    expect(wentColdReason({ step: "meeting_booked", since: null, afterDays: 30 })).toContain("No meeting booked 30 days");
    expect(wentColdReason({ step: "meeting_attended", since: null, afterDays: 30 })).toContain("within 30 days");
  });
  it("a step it does not know still gets a sentence", () => {
    expect(wentColdReason({ step: "something_new", since: null, afterDays: 30 })).toContain("Nothing has moved for 30 days");
  });
  it("carries no em-dash", () => {
    for (const step of ["meeting_booked", "meeting_attended", "x"]) {
      expect(wentColdReason({ step, since: null, afterDays: 30 })).not.toContain("—");
    }
    expect(WENT_COLD_LABEL).not.toContain("—");
  });
});

describe("call sites: the board card and the lead panel read the ONE helper", () => {
  it("the page threads it onto the card and renders it in the panel", () => {
    const page = read("components/audiences/engaged-leads-page.tsx");
    expect(page).toContain("wentCold: leadWentCold(lead.standing)");
    expect(page).toContain("leadWentCold(selectedLead.standing)");
  });
  it("the board card renders the tag, and the panel carries the reason", () => {
    const board = read("components/leads/lead-board.tsx");
    expect(board).toContain('data-testid="lead-board-card-cold"');
    expect(board).toContain("{card.wentCold && (");
    const page = read("components/audiences/engaged-leads-page.tsx");
    expect(page).toContain("wentColdReason(cold)");
  });
});
