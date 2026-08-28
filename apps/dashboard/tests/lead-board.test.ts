import { describe, expect, it } from "vitest";
import {
  DISQUALIFYING_REPLY_KINDS,
  INTEREST_REPLY_KINDS,
  LEAD_BOARD_COLUMNS,
  columnMoveRefusal,
  columnReplyKinds,
  leadBoardColumnFor,
  movableColumnsFrom,
  type LeadTriage,
} from "../src/lib/lead-board";
import { REPLY_KINDS } from "../src/lib/reply-kind";

const base: LeadTriage = {
  contacted: true,
  unsubscribed: false,
  replyKind: null,
  replyClassification: null,
};
const at = (over: Partial<LeadTriage>) => leadBoardColumnFor({ ...base, ...over });

describe("the board is four triage columns", () => {
  it("states them in triage order, and only Opt-out refuses a card", () => {
    expect(LEAD_BOARD_COLUMNS.map((c) => c.key)).toEqual([
      "contacted",
      "sales_interest",
      "disqualified",
      "opt_out",
    ]);
    // Unsubscribing is the PROSPECT's act and it is legally binding, so no control of
    // ours may record it on their behalf.
    expect(LEAD_BOARD_COLUMNS.find((c) => c.key === "opt_out")?.writable).toBe(false);
    for (const key of ["contacted", "sales_interest", "disqualified"] as const) {
      expect(LEAD_BOARD_COLUMNS.find((c) => c.key === key)?.writable).toBe(true);
    }
  });

  it("says in one line what lands in each, because the splits are not obvious", () => {
    for (const column of LEAD_BOARD_COLUMNS) {
      expect(column.blurb.length).toBeGreaterThan(10);
    }
  });

  it("needs no funnel to lay out, unlike the rungs it replaced", () => {
    // Triage states are not ordered by a funnel, so a brand selling through several
    // gets the same four columns a campaign does.
    expect(LEAD_BOARD_COLUMNS).toHaveLength(4);
  });
});

describe("where a lead lands", () => {
  it("puts a contacted lead nobody has answered in Contacted", () => {
    expect(at({})).toBe("contacted");
  });

  it("leaves a lead we never contacted OFF the board entirely", () => {
    // Not a column of its own: there is nothing to show about what happened to it, and
    // inventing one would make the board disagree with the page's own count.
    expect(at({ contacted: false })).toBeNull();
  });

  it("reads the three buying-interest kinds as Sales interest", () => {
    for (const kind of INTEREST_REPLY_KINDS) {
      expect(at({ replyKind: kind })).toBe("sales_interest");
    }
  });

  it("keeps a REFERRAL out of Sales interest", () => {
    // "Not them, but points us on" is valuable and it is not THIS person's interest —
    // the new lead it produces arrives as its own row.
    expect(at({ replyKind: "lead_referral" })).toBe("contacted");
  });

  it("keeps a NO in Contacted, because in sales a no is where the conversation starts", () => {
    expect(at({ replyKind: "lead_not_interested" })).toBe("contacted");
    // And the coarse machine reading of the same message must not move it either.
    expect(at({ replyClassification: "negative" })).toBe("contacted");
  });

  it("keeps a BOUNCE in Contacted", () => {
    // A bounce is a failure of DELIVERY, not an opinion: the address needs repairing,
    // the human behind it may still be interested. It reaches the board as a contacted
    // lead with nothing said, exactly like any other.
    expect(at({ replyClassification: null })).toBe("contacted");
  });

  it("disqualifies only on an objective fact about the person", () => {
    expect(at({ replyKind: "lead_wrong_person" })).toBe("disqualified");
    // Listed before the producer serves it, so the column fills with no change here.
    expect(at({ replyKind: "lead_job_change" })).toBe("disqualified");
    expect(DISQUALIFYING_REPLY_KINDS).toContain("lead_job_change");
  });

  it("puts an opt-out in its own column whatever else is true of the lead", () => {
    expect(at({ unsubscribed: true })).toBe("opt_out");
    // Including a lead who WAS interested: they must not read as still in play.
    expect(at({ unsubscribed: true, replyKind: "lead_interested" })).toBe("opt_out");
    expect(at({ unsubscribed: true, replyKind: "lead_wrong_person" })).toBe("opt_out");
  });

  it("lets a HUMAN's statement outrank the machine's classification", () => {
    // A person read the message; the classifier guessed at it.
    expect(at({ replyKind: "lead_not_interested", replyClassification: "positive" })).toBe(
      "contacted",
    );
    expect(at({ replyKind: "lead_interested", replyClassification: "negative" })).toBe(
      "sales_interest",
    );
  });

  it("falls back to the coarse classification when nobody has stated a kind", () => {
    expect(at({ replyClassification: "positive" })).toBe("sales_interest");
    expect(at({ replyClassification: "neutral" })).toBe("contacted");
  });

  it("reads a kind this build does not know as saying nothing about interest", () => {
    // The producer owns the vocabulary and can widen it before this app ships.
    expect(at({ replyKind: "lead_something_new" })).toBe("contacted");
  });
});

describe("what a person may state from a column", () => {
  it("offers exactly that column's own kinds", () => {
    expect(columnReplyKinds("sales_interest")).toEqual([...INTEREST_REPLY_KINDS]);
    expect(columnReplyKinds("disqualified")).toEqual(["lead_wrong_person"]);
    expect(columnReplyKinds("opt_out")).toEqual([]);
  });

  it("offers no AUTOMATED kind, because nobody states one", () => {
    const contacted = columnReplyKinds("contacted");
    for (const kind of contacted) {
      expect(REPLY_KINDS.find((o) => o.kind === kind)?.tone).not.toBe("automated");
    }
    expect(contacted).toContain("lead_not_interested");
    expect(contacted).toContain("lead_referral");
    expect(contacted).toContain("lead_neutral");
  });

  it("offers only kinds the catalogue actually carries", () => {
    // `lead_job_change` is listed ahead of the producer, so it must NOT reach a picker
    // until the catalogue names it — a button writing a value nothing renders is worse
    // than a column that fills later.
    const every = LEAD_BOARD_COLUMNS.flatMap((c) => columnReplyKinds(c.key));
    for (const kind of every) {
      expect(REPLY_KINDS.some((o) => o.kind === kind)).toBe(true);
    }
    expect(every).not.toContain("lead_job_change");
  });
});

describe("which columns a card may move to", () => {
  it("offers every writable column except the one it is in", () => {
    expect(movableColumnsFrom("contacted").map((c) => c.key)).toEqual([
      "sales_interest",
      "disqualified",
    ]);
    expect(movableColumnsFrom("sales_interest").map((c) => c.key)).toEqual([
      "contacted",
      "disqualified",
    ]);
  });

  it("never offers Opt-out as a destination", () => {
    for (const from of LEAD_BOARD_COLUMNS) {
      expect(movableColumnsFrom(from.key).map((c) => c.key)).not.toContain("opt_out");
    }
  });

  it("never moves a card OUT of Opt-out either", () => {
    // `writable: false` only stops a card ARRIVING. Without this, a lead who asked us
    // to stop could be dragged back into play — the same consent decision we refuse to
    // fabricate, made in the more dangerous direction. Caught by rendering the board,
    // not by reading it: the card was draggable and carried a Move control.
    expect(movableColumnsFrom("opt_out")).toEqual([]);
  });

  it("lets a card move BACK, because triage states are not funnel rungs", () => {
    // Correcting one a person got wrong is a statement like any other, and the
    // producer supersedes the earlier one.
    expect(movableColumnsFrom("disqualified").map((c) => c.key)).toContain("contacted");
  });
});

describe("a drop lands everywhere, and the form is where a move is refused", () => {
  it("refuses only Opt-out, and says why in a sentence a person reads", () => {
    for (const key of ["contacted", "sales_interest", "disqualified"] as const) {
      expect(columnMoveRefusal(key)).toBeNull();
    }
    const refusal = columnMoveRefusal("opt_out");
    expect(refusal).toBeTruthy();
    // The reason, not a bare "not allowed" — the rule is about whose act this is.
    expect(refusal).toMatch(/prospect/i);
  });

  it("has nothing it could write for Opt-out even if it wanted to", () => {
    // The refusal is not a preference: instantly-service's vocabulary carries no
    // unsubscribe value, so the picker for that column is empty by construction.
    expect(columnReplyKinds("opt_out")).toEqual([]);
    expect(columnMoveRefusal("opt_out")).not.toBeNull();
  });
});
