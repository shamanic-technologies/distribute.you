import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BOARD = readFileSync(
  join(__dirname, "../src/components/leads/lead-board.tsx"),
  "utf8",
);
const PAGE = readFileSync(
  join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
  "utf8",
);

/**
 * Growing a board column mints a NEW query key, and `keepPreviousData` keeps the
 * narrower answer on screen while the wider one lands — so without a busy state the
 * press is answered by nothing at all for the seconds a long column takes, and the
 * control reads as dead. These pin BOTH halves: the component able to say it, and the
 * page actually passing it.
 */
describe("show more says it is working", () => {
  it("the button states a busy state and refuses a second press while it works", () => {
    const at = BOARD.indexOf("lead-board-more-");
    expect(at).toBeGreaterThan(-1);
    const slice = BOARD.slice(at - 400, at + 1400);
    expect(slice).toContain("columnPending || columnGrowing");
    expect(slice).toContain("Loading more");
    expect(slice).toContain("animate-spin");
  });

  it("the page passes the growing flag, off isPlaceholderData and not isFetching", () => {
    expect(PAGE).toContain("growing: read.isPlaceholderData");
    // `isFetching` is true on every poll of the SAME key, so it would blink the
    // control every 15 seconds on a column nobody is growing.
    expect(PAGE).not.toContain("growing: read.isFetching");
  });

  it("the growing flag is a dep the columns memo can see", () => {
    expect(PAGE).toContain("const boardGrowing = LEAD_BOARD_COLUMNS.map(");
    const memoAt = PAGE.indexOf("const boardColumns = useMemo(");
    expect(memoAt).toBeGreaterThan(-1);
    expect(PAGE.indexOf("const boardGrowing =")).toBeLessThan(memoAt);
    expect(PAGE.slice(memoAt)).toContain("boardGrowing,");
  });
});
