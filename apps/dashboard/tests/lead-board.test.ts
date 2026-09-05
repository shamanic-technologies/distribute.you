import { describe, expect, it } from "vitest";
import {
  DISQUALIFYING_STATEMENT_KINDS,
  INTEREST_STATEMENT_KINDS,
  LEAD_BOARD_COLUMNS,
  LEAD_BOARD_PAGE_SIZE,
  columnBlurb,
  columnMoveConfirmation,
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

describe("the board is six triage columns", () => {
  it("states them in triage order, and only Not-placed refuses a card", () => {
    // Close won sits between the warm column and the out-of-play ones: it is what the
    // funnel produces, so it reads after interest and before every way of being done.
    expect(LEAD_BOARD_COLUMNS.map((c) => c.key)).toEqual([
      "contacted",
      "sales_interest",
      "won",
      "disqualified",
      "opt_out",
      "unresolved",
    ]);
    // "Not placed" is the producer saying it could not answer, which nobody can assert
    // their way into. Every other column is a statement somebody can honestly make —
    // Opt-out included: a prospect who asks us to stop by SMS said it just as much as
    // one who clicked the link, and refusing to RECORD that is not protecting their
    // consent, it is ignoring it while we keep emailing them.
    expect(LEAD_BOARD_COLUMNS.find((c) => c.key === "unresolved")?.writable).toBe(false);
    for (const key of ["contacted", "sales_interest", "won", "disqualified", "opt_out"] as const) {
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
    // there; the other five are the shape of the board and stay either way.
    for (const column of LEAD_BOARD_COLUMNS) {
      expect(column.hideWhenEmpty).toBe(column.key === "unresolved");
    }
  });

  it("needs no funnel to lay out, unlike the rungs it replaced", () => {
    // Triage states are not ordered by a funnel, so a brand selling through several
    // gets the same columns a campaign does.
    expect(LEAD_BOARD_COLUMNS).toHaveLength(6);
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
    // Its own column since the board grew one: a closed deal is the outcome the funnel
    // exists to produce, and folding it into Sales interest read it as a warm one.
    expect(at("customer", "stated_outcome")).toBe("won");
  });

  it("reads an OPT-OUT as the state lead-service now names, not as a signal of ours", () => {
    // `opted_out` is its own standing upstream. It used to be a shade of
    // `disqualified` that this module split on the deciding evidence — a rule of ours
    // over a producer's field, which is exactly the kind of second opinion that breaks
    // silently: the day the producer split the state, every opt-out fell through to
    // "Not placed" and nothing went red.
    expect(at("opted_out", "unsubscribed")).toBe("opt_out");
    // The state decides it, whatever evidence is named beside it.
    expect(at("opted_out", "stated_never")).toBe("opt_out");
    // The PRE-SPLIT spelling still reads as an opt-out. A row written before the
    // producer split the state is still somebody who asked us to stop, and filing it
    // as an ordinary disqualification would offer a move that puts them back in play.
    expect(at("disqualified", "unsubscribed")).toBe("opt_out");
    // Every other way of being out of play reads as the ordinary verdict.
    for (const signal of ["negative_reply", "bounced", "stated_never"]) {
      expect(at("disqualified", signal)).toBe("disqualified");
    }
  });

  it("sends a plain NO to Disqualified, which is a change a reader will notice", () => {
    // This module used to keep it in Contacted on the sales-canon split between a
    // temporary no and a permanent one. lead-service reads a negative reply as out of
    // play for THIS campaign and it is the owner; a client-side override to preserve
    // the older reading is the split this change closes.
    expect(at("disqualified", "negative_reply")).toBe("disqualified");
  });

  it("renders a BOUNCE wherever the producer puts it, and does not re-judge it", () => {
    // A bad address says nothing about whether the human behind it would buy, so a
    // bounce is not a disqualification — and that rule lives at the PRODUCER now
    // (sales-lead-service#478), which is why there is nothing here that reads
    // `bounced`. The card stays in Leads and wears "Bounced" as its own tag.
    const src = readBoardSource();
    expect(src.slice(src.indexOf("export function leadBoardColumnFor("))).not.toContain("bounced");
    // Whatever state the producer sends for a bounced lead is what it renders.
    expect(at("contacted", "bounced")).toBe("contacted");
    expect(at("engaged", "bounced")).toBe("contacted");
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
    expect(columnReplyKinds("disqualified")).toEqual([
      "lead_wrong_person",
      "lead_changed_job",
    ]);
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
    // The filter is what stops a kind listed ahead of this app's own catalogue from
    // reaching a picker — a button writing a value nothing renders is worse than a
    // column that fills later. `lead_changed_job` now HAS a label, so it is offered.
    expect(DISQUALIFYING_STATEMENT_KINDS).toContain("lead_changed_job");
    const every = LEAD_BOARD_COLUMNS.flatMap((c) => columnReplyKinds(c.key));
    for (const kind of every) {
      expect(REPLY_KINDS.some((o) => o.kind === kind)).toBe(true);
    }
    expect(every).toContain("lead_changed_job");
  });

  it("keeps a decline about the MOMENT out of the Disqualified picker", () => {
    // Disqualified means "not our target". "Not interested" is a judgement about the
    // offer today, so the person stays reachable and the card stays in Leads —
    // stating it from the Disqualified column would assert something else entirely.
    expect(columnReplyKinds("disqualified")).not.toContain("lead_not_interested");
    expect(columnReplyKinds("contacted")).toContain("lead_not_interested");
  });
});

describe("which columns a card may move to", () => {
  it("offers every writable column except the one it is in", () => {
    expect(movableColumnsFrom("contacted").map((c) => c.key)).toEqual([
      "sales_interest",
      "won",
      "disqualified",
      "opt_out",
    ]);
    expect(movableColumnsFrom("sales_interest").map((c) => c.key)).toEqual([
      "contacted",
      "won",
      "disqualified",
      "opt_out",
    ]);
  });

  it("moves a card between ANY two triage columns, in both directions", () => {
    // Every pair, both ways. The four triage columns are states somebody can be wrong
    // about, so every correction has to be reachable — including out of Opt-out, which
    // used to be a dead end whose only fix was a database write.
    // Close won included, in BOTH directions: a sale gets recorded on the wrong lead,
    // and the undo lead-service offers is a withdrawal of the statement rather than the
    // opposite statement — so leaving is a real move, not a dead end.
    const triage = ["contacted", "sales_interest", "won", "disqualified", "opt_out"] as const;
    for (const from of triage) {
      expect(movableColumnsFrom(from).map((c) => c.key).sort()).toEqual(
        triage.filter((k) => k !== from).slice().sort(),
      );
    }
  });

  it("never offers Not-placed as a destination", () => {
    for (const from of LEAD_BOARD_COLUMNS) {
      expect(movableColumnsFrom(from.key).map((c) => c.key)).not.toContain("unresolved");
    }
  });

  it("asks somebody to confirm when a card leaves a column somebody WROTE", () => {
    // Every other move states something about a reply and the next statement supersedes
    // it. This one puts a person who asked us to stop back where we can contact them,
    // so it says what it does AND what it does not do — nothing that was stopped starts
    // again on its own.
    for (const key of ["contacted", "sales_interest", "disqualified", "unresolved"] as const) {
      expect(columnMoveConfirmation(key)).toBeNull();
    }
    // Leaving Close won asks too, and for the same reason: it takes back something
    // somebody WROTE, and the money it removes is removed at every grain.
    const leavingWon = columnMoveConfirmation("won");
    expect(leavingWon).toMatch(/takes the deal back/i);
    expect(leavingWon).toMatch(/stops counting/i);
    expect(columnMoveConfirmation(null)).toBeNull();
    const leaving = columnMoveConfirmation("opt_out");
    expect(leaving).toMatch(/asked us to stop/i);
    expect(leaving).toMatch(/nothing that was stopped starts again/i);
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
  it("refuses Not-placed alone, and says why", () => {
    for (const key of ["contacted", "sales_interest", "won", "disqualified", "opt_out"] as const) {
      expect(columnMoveRefusal(key)).toBeNull();
    }
    // The reason, not a bare "not allowed": nothing anybody states about the person
    // settles a campaign that names no sales funnel.
    expect(columnMoveRefusal("unresolved")).toMatch(/funnel/i);
  });

  it("offers no REPLY KIND for Opt-out or Not-placed, for different reasons", () => {
    // Opt-out states the CHANNEL somebody told us through, not a reply kind — a
    // different write, to a different producer, scoped to the person rather than to
    // this campaign. So an empty picker here is NOT "nothing can be written", and the
    // column is writable. Not-placed really is nothing: lead-service could not answer.
    for (const key of ["opt_out", "unresolved"] as const) {
      expect(columnReplyKinds(key)).toEqual([]);
    }
    expect(columnMoveRefusal("opt_out")).toBeNull();
    expect(columnMoveRefusal("unresolved")).not.toBeNull();
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

describe("columnBlurb", () => {
  const disqualified = LEAD_BOARD_COLUMNS.find((c) => c.key === "disqualified")!;

  // "Not our target" is a judgement about ONE grain, and this board renders at four.
  it("names the scope the reader is standing in", () => {
    expect(columnBlurb(disqualified, "offer")).toBe(
      "Individuals disqualified as leads for this offer.",
    );
    expect(columnBlurb(disqualified, "sales funnel")).toBe(
      "Individuals disqualified as leads for this sales funnel.",
    );
  });

  // Absent scope reads "campaign" — the grain this board is mounted at whenever it can
  // be written to — rather than leaving a `{scope}` token on screen.
  it("falls back to campaign rather than printing the token", () => {
    for (const scope of [undefined, null, ""]) {
      expect(columnBlurb(disqualified, scope)).toBe(
        "Individuals disqualified as leads for this campaign.",
      );
    }
  });

  it("leaves a blurb with no token alone", () => {
    const leads = LEAD_BOARD_COLUMNS.find((c) => c.key === "contacted")!;
    expect(columnBlurb(leads, "offer")).toBe(leads.blurb);
  });
});
