import { describe, expect, it } from "vitest";
import {
  EMPTY_STATED_AMOUNT_DRAFT,
  isInForceToday,
  statedAmountBody,
  statedAmountDraftProblem,
  statedAmountErrorMessage,
  termLabel,
  type StatedAmountDraft,
} from "@/lib/stated-amount-write";

function draft(over: Partial<StatedAmountDraft> = {}): StatedAmountDraft {
  return {
    ...EMPTY_STATED_AMOUNT_DRAFT,
    orgId: "org-1",
    brandId: "brand-1",
    amount: "4000",
    ...over,
  };
}

describe("statedAmountErrorMessage", () => {
  it("renders the producer's OWN reason on a 409, because it names the row in the way", () => {
    const msg = statedAmountErrorMessage(409, {
      error: "stated_amount_conflict",
      reason: "overlaps the amount in force from 2026-07-01 to 2026-08-31",
    });
    expect(msg).toBe("overlaps the amount in force from 2026-07-01 to 2026-08-31");
  });

  it("never surfaces the machine token as the message", () => {
    // `err.message` on that 409 is literally "stated_amount_conflict" — the whole
    // point of this helper is that a person never reads that.
    const msg = statedAmountErrorMessage(409, { error: "stated_amount_conflict", reason: "…" });
    expect(msg).not.toContain("stated_amount_conflict");
  });

  it("still says something useful when a 409 carries no reason", () => {
    const msg = statedAmountErrorMessage(409, { error: "stated_amount_conflict" });
    expect(msg).toContain("already covers");
  });

  it("tells the reader their list is stale on a 404", () => {
    expect(statedAmountErrorMessage(404, { error: "stated_amount_not_found" })).toContain("Reload");
  });

  it("prefers the producer's sentence on a 400", () => {
    expect(statedAmountErrorMessage(400, { error: "endDate is before startDate" })).toBe(
      "endDate is before startDate",
    );
  });

  it("names the staff gate on a 403", () => {
    expect(statedAmountErrorMessage(403, {})).toContain("staff");
  });

  it("degrades to one generic line on anything else, including a null status", () => {
    expect(statedAmountErrorMessage(500, null)).toContain("Could not save");
    expect(statedAmountErrorMessage(null, undefined)).toContain("Could not save");
  });
});

describe("statedAmountDraftProblem", () => {
  it("asks for a brand first", () => {
    expect(statedAmountDraftProblem(EMPTY_STATED_AMOUNT_DRAFT)).toContain("Pick a brand");
  });

  it("asks for an amount when the field is empty or not a number", () => {
    expect(statedAmountDraftProblem(draft({ amount: "" }))).toContain("how much");
    expect(statedAmountDraftProblem(draft({ amount: "abc" }))).toContain("how much");
  });

  it("refuses a negative amount", () => {
    expect(statedAmountDraftProblem(draft({ amount: "-1" }))).toContain("negative");
  });

  it("ACCEPTS a stated zero — it is a real answer, not a missing one", () => {
    expect(statedAmountDraftProblem(draft({ amount: "0" }))).toBeNull();
  });

  it("ACCEPTS both bounds empty — each open end is a statement, not a gap", () => {
    expect(statedAmountDraftProblem(draft({ startDate: "", endDate: "" }))).toBeNull();
  });

  it("refuses a malformed date on either bound", () => {
    expect(statedAmountDraftProblem(draft({ startDate: "07/2026" }))).toContain("start date");
    expect(statedAmountDraftProblem(draft({ endDate: "soon" }))).toContain("end date");
  });

  it("refuses an end before a start", () => {
    expect(
      statedAmountDraftProblem(draft({ startDate: "2026-08-01", endDate: "2026-07-01" })),
    ).toContain("before the start");
  });

  it("says nothing about OVERLAP — only the server holds the other rows", () => {
    const ok = draft({ startDate: "2026-07-01", endDate: "2026-08-31" });
    expect(statedAmountDraftProblem(ok)).toBeNull();
  });
});

describe("statedAmountBody", () => {
  it("sends an empty bound as an explicit null, never as an omitted key", () => {
    // On a PATCH an omitted key KEEPS the stored bound while null OPENS it, so
    // clearing a date has to travel as null to mean what the person did.
    const body = statedAmountBody(draft({ startDate: "", endDate: "" }));
    expect(body.startDate).toBeNull();
    expect(body.endDate).toBeNull();
    expect("startDate" in body).toBe(true);
    expect("endDate" in body).toBe(true);
  });

  it("carries the dates through when they are set", () => {
    const body = statedAmountBody(draft({ startDate: "2026-07-01", endDate: "2026-08-31" }));
    expect(body.startDate).toBe("2026-07-01");
    expect(body.endDate).toBe("2026-08-31");
  });

  it("sends the amount in dollars as a number", () => {
    expect(statedAmountBody(draft({ amount: "4000" })).amountUsd).toBe(4000);
    expect(statedAmountBody(draft({ amount: "1234.56" })).amountUsd).toBe(1234.56);
  });

  it("trims a note and sends a blank one as null", () => {
    expect(statedAmountBody(draft({ note: "  discretionary  " })).note).toBe("discretionary");
    expect(statedAmountBody(draft({ note: "   " })).note).toBeNull();
  });
});

describe("termLabel", () => {
  it("states what an open START means rather than printing a dash", () => {
    expect(termLabel(null, "2026-08-31")).toBe("Since this brand’s first day of spend, to 2026-08-31");
  });

  it("states what an open END means", () => {
    expect(termLabel("2026-07-01", null)).toBe("From 2026-07-01, ongoing");
  });

  it("states both when both are open", () => {
    const label = termLabel(null, null);
    expect(label).toContain("first day of spend");
    expect(label).toContain("ongoing");
  });

  it("reads as a plain range when both are set", () => {
    expect(termLabel("2026-07-01", "2026-08-31")).toBe("From 2026-07-01, to 2026-08-31");
  });
});

describe("isInForceToday", () => {
  const today = "2026-09-12";

  it("counts a row with both ends open", () => {
    expect(isInForceToday(null, null, today)).toBe(true);
  });

  it("counts a row whose start has passed and whose end is open", () => {
    expect(isInForceToday("2026-07-01", null, today)).toBe(true);
  });

  it("drops a row that has ended", () => {
    expect(isInForceToday("2026-07-01", "2026-08-31", today)).toBe(false);
  });

  it("drops a row that has not started", () => {
    expect(isInForceToday("2026-10-01", null, today)).toBe(false);
  });

  it("treats both bounds as INCLUSIVE", () => {
    expect(isInForceToday(today, today, today)).toBe(true);
  });

  it("reads an open start as in force — its real floor is the brand's first billed day, always past", () => {
    expect(isInForceToday(null, "2026-12-31", today)).toBe(true);
  });
});
