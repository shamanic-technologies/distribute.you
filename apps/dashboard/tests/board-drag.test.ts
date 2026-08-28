/**
 * The gesture EVERY kanban in the dashboard shares.
 *
 * `lib/board-drag.ts` is alias-free precisely so these are real unit tests rather than
 * assertions about how the file is spelled — keep it that way. The React half (the
 * pointer handlers, the frame loop) is guarded by the two board surface tests.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LONG_PRESS_MS,
  SLOP_PX,
  isRealMove,
  railScrollStep,
  showsDropSlot,
  wandered,
} from "../src/lib/board-drag";

describe("wandered — a press that moved was a scroll", () => {
  it("holds still inside the slop", () => {
    expect(wandered({ x: 100, y: 100 }, { x: 106, y: 94 })).toBe(false);
  });

  it("gives the gesture up once the pointer leaves it, on either axis", () => {
    expect(wandered({ x: 100, y: 100 }, { x: 120, y: 100 })).toBe(true);
    expect(wandered({ x: 100, y: 100 }, { x: 100, y: 80 })).toBe(true);
  });

  it("keeps a board scrollable by finger — the slop is why", () => {
    // Without it every swipe starting on a card would lift it after the hold.
    expect(SLOP_PX).toBeGreaterThan(0);
    expect(LONG_PRESS_MS).toBeGreaterThan(0);
  });
});

describe("isRealMove — dropped back where it started is a cancelled drag", () => {
  it("is no move when the card lands in its own column", () => {
    expect(isRealMove("contacted", "contacted")).toBe(false);
  });

  it("is no move when the pointer is over no column at all", () => {
    expect(isRealMove("contacted", null)).toBe(false);
    expect(isRealMove("contacted", undefined)).toBe(false);
  });

  it("is a move into any other column", () => {
    expect(isRealMove("contacted", "sales_interest")).toBe(true);
  });
});

describe("showsDropSlot — where the held card would land, before release", () => {
  it("opens no slot while nothing is held", () => {
    expect(showsDropSlot("to", null)).toBe(false);
  });

  it("opens one in the column under the pointer", () => {
    expect(showsDropSlot("to", { column: "from", over: "to" })).toBe(true);
  });

  it("opens none in a column the pointer is not over", () => {
    expect(showsDropSlot("from", { column: "from", over: "to" })).toBe(false);
  });

  it("opens none in the card's OWN column — that is a cancel, not a landing", () => {
    expect(showsDropSlot("from", { column: "from", over: "from" })).toBe(false);
  });
});

describe("railScrollStep — the rail scrolls itself under a held card", () => {
  const bounds = { left: 0, right: 400 };

  it("stands still in the middle", () => {
    expect(railScrollStep(200, bounds)).toBe(0);
  });

  it("runs right at the right edge and left at the left one", () => {
    expect(railScrollStep(395, bounds)).toBeGreaterThan(0);
    expect(railScrollStep(5, bounds)).toBeLessThan(0);
  });

  it("keeps running while the finger is parked, since no move event follows", () => {
    // Same input twice, same answer: the caller runs it per FRAME.
    expect(railScrollStep(395, bounds)).toBe(railScrollStep(395, bounds));
  });
});

describe("the module stays alias-free so it carries real unit tests", () => {
  it("imports nothing through the @ alias", () => {
    const src = readFileSync(join(__dirname, "..", "src/lib/board-drag.ts"), "utf8");
    expect(src).not.toMatch(/from "@\//);
  });
});
