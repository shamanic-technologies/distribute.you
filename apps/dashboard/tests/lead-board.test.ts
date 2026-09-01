import { describe, expect, it } from "vitest";
import {
  DISQUALIFYING_STATEMENT_KINDS,
  INTEREST_STATEMENT_KINDS,
  LEAD_BOARD_COLUMNS,
  LEAD_BOARD_PAGE_SIZE,
  columnMoveRefusal,
  columnPage,
  columnReplyKinds,
  leadBoardColumnFor,
  movableColumnsFrom,
  type LeadBoardStanding,
} from "../src/lib/lead-board";
import { REPLY_KINDS } from "../src/lib/reply-kind";

/** One served standing. `signal` matters for exactly one branch — see the opt-out test. */
const at = (state: string, signal = "none") =>
  leadBoardColumnFor({ state, signal } as unknown as LeadBoardStanding);

describe("the board is five triage columns", () => {
  it("states them in triage order, and only the two we cannot write refuse a card", () => {
    expect(LEAD_BOARD_COLUMNS.map((c) => c.key)).toEqual([
      "contacted",
      "sales_interest",
      "disqualified",
      "opt_out",
      "unresolved",
    ]);
    // Unsubscribing is the PROSPECT's act and it is legally binding, so no control of
    // ours may record it on their behalf; "Not placed" is the producer saying it could
    // not answer, which nobody can assert their way into.
    expect(LEAD_BOARD_COLUMNS.find((c) => c.key === "opt_out")?.writable).toBe(false);
    expect(LEAD_BOARD_COLUMNS.find((c) => c.key === "unresolved")?.writable).toBe(false);
    for (const key of ["contacted", "sales_interest", "disqualified"] as const) {
      expect(LEAD_BOARD_COLUMNS.find((c) => c.key === key)?.writable).toBe(true);
    }
  });

  it("says in one line what lands in each, because the splits are not obvious", () => {
    for (const column of LEAD_BOARD_COLUMNS) {
      expect(column.blurb.length).toBeGreaterThan(10);
    }
  });

  it("drops ONLY the producer-failure column when it holds nothing", () => {
    // Drawing "Not placed" on a healthy campaign advertises a problem that is not
    // there; the other four are the shape of the board and stay either way.
    for (const column of LEAD_BOARD_COLUMNS) {
      expect(column.hideWhenEmpty).toBe(column.key === "unresolved");
    }
  });

  it("needs no funnel to lay out, unlike the rungs it replaced", () => {
    // Triage states are not ordered by a funnel, so a brand selling through several
    // gets the same columns a campaign does.
    expect(LEAD_BOARD_COLUMNS).toHaveLength(5);
  });
});

describe("where a lead lands is the PRODUCER's answer, rendered", () => {
  it("renders each served state as its column", () => {
    expect(at("contacted")).toBe("contacted");
    // Something happened that this campaign does not sell — still in play.
    expect(at("engaged", "click")).toBe("contacted");
    expect(at("sales_interest", "measured_visit")).toBe("sales_interest");
    expect(at("disqualified", "negative_reply")).toBe("disqualified");
    expect(at("unresolved")).toBe("unresolved");
  });

  it("leaves a lead we never contacted OFF the board entirely", () => {
    // Not a column of its own: there is nothing to show about what happened to it, and
    // inventing one would make the board disagree with the page's own count.
    expect(at("not_contacted", "not_served")).toBeNull();
  });

  it("reads a MEASURED VISIT as sales interest, which a reply signal never could", () => {
    // The whole reason placement moved: on a campaign selling `form_magnet` the step
    // being sold is a website visit, so somebody who clicked through has reached it.
    // Deriving interest from a reply here showed that column empty on a campaign with
    // 67 such leads.
    expect(at("sales_interest", "measured_visit")).toBe("sales_interest");
  });

  it("folds a CUSTOMER into Sales interest rather than inventing a verdict for it", () => {
    // They reached the step this campaign sells and then some. Four triage buckets
    // have no room for a fifth verdict, and the column's blurb says so.
    expect(at("customer", "stated_outcome")).toBe("sales_interest");
  });

  it("splits an OPT-OUT out of the producer's one disqualified state, by its signal", () => {
    // lead-service folds an opt-out into `disqualified` — right for it, both are out
    // of play. Not right here: an opt-out is the prospect's own act and legally
    // binding, so it gets its own column and nothing of ours may write one.
    expect(at("disqualified", "unsubscribed")).toBe("opt_out");
    // Every other way of being out of play reads as the ordinary verdict.
    for (const signal of ["negative_reply", "bounced", "stated_never"]) {
      expect(at("disqualified", signal)).toBe("disqualified");
    }
  });

  it("sends a BOUNCE and a plain NO to Disqualified now, which is a change", () => {
    // This module used to keep both in Contacted on purpose — a bounce is a failure of
    // DELIVERY, and in sales a no is where the conversation starts. lead-service reads
    // both as out of play for this campaign and it is the owner; a client-side
    // override to preserve the older reading is the split this change closes.
    expect(at("disqualified", "bounced")).toBe("disqualified");
    expect(at("disqualified", "negative_reply")).toBe("disqualified");
  });

  it("holds NO reply-kind list and NO precedence ladder of its own", () => {
    const src = readBoardSource();
    // The policy that used to live here, by name.
    expect(src).not.toContain("INTEREST_REPLY_KINDS");
    expect(src).not.toContain("DISQUALIFYING_REPLY_KINDS");
    // And the fields it used to read to decide a state.
    const fn = src.slice(src.indexOf("export function leadBoardColumnFor("));
    expect(fn).not.toContain("replyClassification");
    expect(fn).not.toContain("replyKind");
    expect(fn).not.toContain("unsubscribed:");
    expect(fn).toContain("standing.state");
  });

  it("states 'we cannot place this' for an ABSENT standing, never a rule of its own", () => {
    // A payload written before lead-service v0.64.0 — a snapshot restored from disk,
    // in practice, for the second before the poll lands. A second implementation kept
    // alive for old payloads is exactly the split this change exists to close.
    expect(leadBoardColumnFor(null)).toBe("unresolved");
    expect(leadBoardColumnFor(undefined)).toBe("unresolved");
  });

  it("states the same for a STATE this build does not name", () => {
    // lead-service owns the vocabulary and can widen it before this app ships, so the
    // honest render for a word we do not know is "we cannot place this", never the
    // nearest column we happen to have.
    expect(at("something_new")).toBe("unresolved");
  });
});

describe("what a person may state from a column", () => {
  it("offers exactly that column's own kinds", () => {
    expect(columnReplyKinds("sales_interest")).toEqual([...INTEREST_STATEMENT_KINDS]);
    expect(columnReplyKinds("disqualified")).toEqual(["lead_wrong_person"]);
    expect(columnReplyKinds("opt_out")).toEqual([]);
    expect(columnReplyKinds("unresolved")).toEqual([]);
  });

  it("keeps a REFERRAL out of the Sales-interest picker", () => {
    // "Not them, but points us on" is not THIS person's interest, and instantly-service
    // projects it to `neutral` for the same reason — so offering it would offer a move
    // nothing could honour.
    expect(columnReplyKinds("sales_interest")).not.toContain("lead_referral");
    expect(columnReplyKinds("contacted")).toContain("lead_referral");
  });

  it("offers no AUTOMATED kind, because nobody states one", () => {
    const contacted = columnReplyKinds("contacted");
    for (const kind of contacted) {
      expect(REPLY_KINDS.find((o) => o.kind === kind)?.tone).not.toBe("automated");
    }
    expect(contacted).toContain("lead_not_interested");
    expect(contacted).toContain("lead_neutral");
  });

  it("offers only kinds the catalogue actually carries", () => {
    // `lead_changed_job` is listed ahead of this app's own catalogue (instantly-service
    // already serves it), so it must NOT reach a picker until there is a label — a
    // button writing a value nothing renders is worse than a column that fills later.
    expect(DISQUALIFYING_STATEMENT_KINDS).toContain("lead_changed_job");
    const every = LEAD_BOARD_COLUMNS.flatMap((c) => columnReplyKinds(c.key));
    for (const kind of every) {
      expect(REPLY_KINDS.some((o) => o.kind === kind)).toBe(true);
    }
    expect(every).not.toContain("lead_changed_job");
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

  it("never offers Opt-out or Not-placed as a destination", () => {
    for (const from of LEAD_BOARD_COLUMNS) {
      expect(movableColumnsFrom(from.key).map((c) => c.key)).not.toContain("opt_out");
      expect(movableColumnsFrom(from.key).map((c) => c.key)).not.toContain("unresolved");
    }
  });

  it("never moves a card OUT of Opt-out either", () => {
    // `writable: false` only stops a card ARRIVING. Without this, a lead who asked us
    // to stop could be dragged back into play — the same consent decision we refuse to
    // fabricate, made in the more dangerous direction.
    expect(movableColumnsFrom("opt_out")).toEqual([]);
  });

  it("never moves a card out of Not-placed, because nothing anybody states would move it", () => {
    // A card is there when lead-service could not resolve the campaign's funnel, and
    // its ladder answers `unresolved` before it ever looks at a statement. Offering
    // the move would offer a control that cannot take.
    expect(movableColumnsFrom("unresolved")).toEqual([]);
  });

  it("lets a card move BACK, because triage states are not funnel rungs", () => {
    // Correcting one a person got wrong is a statement like any other, and the
    // producer supersedes the earlier one.
    expect(movableColumnsFrom("disqualified").map((c) => c.key)).toContain("contacted");
  });
});

describe("a drop lands everywhere, and the form is where a move is refused", () => {
  it("refuses the two unwritable columns, each with its own reason", () => {
    for (const key of ["contacted", "sales_interest", "disqualified"] as const) {
      expect(columnMoveRefusal(key)).toBeNull();
    }
    // The reason, not a bare "not allowed" — the rule is about whose act this is.
    expect(columnMoveRefusal("opt_out")).toMatch(/prospect/i);
    expect(columnMoveRefusal("unresolved")).toMatch(/funnel/i);
  });

  it("has nothing it could write for either even if it wanted to", () => {
    // Not a preference: instantly-service's vocabulary carries no unsubscribe value,
    // so the picker for that column is empty by construction.
    for (const key of ["opt_out", "unresolved"] as const) {
      expect(columnReplyKinds(key)).toEqual([]);
      expect(columnMoveRefusal(key)).not.toBeNull();
    }
  });
});

describe("a column draws a page and states its tail", () => {
  it("draws the page size and says how many are left", () => {
    expect(columnPage(400, LEAD_BOARD_PAGE_SIZE)).toEqual({
      visible: LEAD_BOARD_PAGE_SIZE,
      remaining: 400 - LEAD_BOARD_PAGE_SIZE,
    });
  });

  it("never claims a tail on a column that fits", () => {
    expect(columnPage(3, LEAD_BOARD_PAGE_SIZE)).toEqual({ visible: 3, remaining: 0 });
    expect(columnPage(0, LEAD_BOARD_PAGE_SIZE)).toEqual({ visible: 0, remaining: 0 });
  });

  it("clamps a reveal that outlived the set it was made on", () => {
    // A poll (or a search) can shrink a column under a reader who already pressed
    // "Show more" several times; the count is a request, never a promise about size.
    expect(columnPage(5, 200)).toEqual({ visible: 5, remaining: 0 });
  });

  it("treats a nonsense count as showing nothing rather than everything", () => {
    expect(columnPage(10, -1)).toEqual({ visible: 0, remaining: 10 });
  });
});

function readBoardSource(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  return readFileSync(join(__dirname, "..", "src", "lib", "lead-board.ts"), "utf8");
}
