import { describe, expect, it } from "vitest";
import {
  SOURCE_LABEL,
  leadBoardColumnFor,
  leadBoardColumns,
  movableColumnsFrom,
  stageSource,
} from "../src/lib/lead-board";
import { LEAD_STAGE_KEYS, WRITABLE_STAGE_KEYS } from "../src/lib/lead-funnel-stages";

const replyBoard = leadBoardColumns("sales_meetings_from_conversation");
const signupBoard = leadBoardColumns("website_purchases");

describe("leadBoardColumns — the funnel's own steps, plus the one that is not a step", () => {
  it("lays a reply-led funnel out in order, behind a Contacted column", () => {
    expect(replyBoard.map((c) => c.key)).toEqual([
      "outreach",
      "positive_reply",
      "meeting_booked",
      "meeting_attended",
      "sale",
    ]);
    expect(replyBoard.map((c) => c.label)).toEqual([
      "Contacted",
      "Replied",
      "Meeting booked",
      "Meeting attended",
      "Paid client",
    ]);
  });

  it("lays a visit-led funnel out in its own order", () => {
    expect(signupBoard.map((c) => c.key)).toEqual([
      "outreach",
      "website_visit",
      "signup",
      "sale",
    ]);
  });

  it("states NOTHING when there is no single funnel to walk", () => {
    // The brand-level case by construction: a brand sells through several funnels at
    // once, so there is no one order to lay a board out in.
    expect(leadBoardColumns(null)).toEqual([]);
    expect(leadBoardColumns(undefined)).toEqual([]);
  });

  it("marks exactly the steps lead-service accepts a statement on as writable", () => {
    for (const column of replyBoard.concat(signupBoard)) {
      const expected =
        column.key !== "outreach" &&
        (WRITABLE_STAGE_KEYS as readonly string[]).includes(column.key);
      expect({ key: column.key, writable: column.writable }).toEqual({
        key: column.key,
        writable: expected,
      });
    }
  });

  it("never lets a person move a card into a measured step", () => {
    const replied = replyBoard.find((c) => c.key === "positive_reply")!;
    const visited = signupBoard.find((c) => c.key === "website_visit")!;
    expect(replied.writable).toBe(false);
    expect(visited.writable).toBe(false);
    expect(replyBoard.find((c) => c.key === "outreach")!.writable).toBe(false);
  });
});

describe("stageSource — which of these did we update ourselves", () => {
  it("answers for every stage the catalogue can produce", () => {
    for (const key of LEAD_STAGE_KEYS) {
      expect(["measured", "tracked", "stated"]).toContain(stageSource(key));
    }
  });

  it("calls a delivery event measured and a human statement stated", () => {
    expect(stageSource("positive_reply")).toBe("measured");
    expect(stageSource("website_visit")).toBe("measured");
    expect(stageSource("signup")).toBe("tracked");
    expect(stageSource("form_submission")).toBe("tracked");
    expect(stageSource("meeting_booked")).toBe("stated");
    expect(stageSource("meeting_attended")).toBe("stated");
    expect(stageSource("sale")).toBe("stated");
  });

  it("every writable stage is one a person states", () => {
    // The two sets are the same claim from opposite sides: a step a person can move a
    // card into is a step nothing observes.
    for (const key of WRITABLE_STAGE_KEYS) expect(stageSource(key)).not.toBe("measured");
  });

  it("names each source in words, with no em-dash", () => {
    for (const label of Object.values(SOURCE_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toContain("—");
    }
  });
});

describe("leadBoardColumnFor — one lead, exactly one column", () => {
  it("puts a lead in the FURTHEST step it reached, not the latest signal", () => {
    expect(
      leadBoardColumnFor(replyBoard, { positive_reply: true, meeting_booked: true }, true),
    ).toBe("meeting_booked");
    expect(
      leadBoardColumnFor(replyBoard, { meeting_booked: true, sale: true }, true),
    ).toBe("sale");
  });

  it("reads a later step alone as the furthest, since the funnel implies the earlier ones", () => {
    expect(leadBoardColumnFor(replyBoard, { meeting_attended: true }, true)).toBe(
      "meeting_attended",
    );
  });

  it("falls to Contacted when no step of the funnel was reached", () => {
    expect(leadBoardColumnFor(replyBoard, {}, true)).toBe("outreach");
  });

  it("leaves a lead we never contacted OFF the board entirely", () => {
    // Nothing happened to it, so there is nothing to show about what happened to it —
    // and inventing a column would make the board disagree with the page's own count.
    expect(leadBoardColumnFor(replyBoard, {}, false)).toBeNull();
  });

  it("ignores a step that belongs to a DIFFERENT funnel", () => {
    // A signup is not a step of the reply funnel, so it cannot place a card on it.
    expect(leadBoardColumnFor(replyBoard, { signup: true }, true)).toBe("outreach");
    expect(leadBoardColumnFor(signupBoard, { meeting_booked: true }, true)).toBe("outreach");
  });

  it("treats a false and an absent flag the same way", () => {
    expect(leadBoardColumnFor(replyBoard, { meeting_booked: false }, true)).toBe("outreach");
  });
});

describe("movableColumnsFrom — where a card may go", () => {
  it("offers every writable step except the one the card is in", () => {
    expect(movableColumnsFrom(replyBoard, "meeting_booked").map((c) => c.key)).toEqual([
      "meeting_attended",
      "sale",
    ]);
  });

  it("offers a BACKWARD move too — a correction is a statement like any other", () => {
    expect(movableColumnsFrom(replyBoard, "sale").map((c) => c.key)).toEqual([
      "meeting_booked",
      "meeting_attended",
    ]);
  });

  it("offers every writable step to a card nobody has moved yet", () => {
    expect(movableColumnsFrom(replyBoard, "outreach").map((c) => c.key)).toEqual([
      "meeting_booked",
      "meeting_attended",
      "sale",
    ]);
    expect(movableColumnsFrom(replyBoard, null).map((c) => c.key)).toEqual([
      "meeting_booked",
      "meeting_attended",
      "sale",
    ]);
  });

  it("offers nothing on a board with no funnel", () => {
    expect(movableColumnsFrom([], null)).toEqual([]);
  });
});
