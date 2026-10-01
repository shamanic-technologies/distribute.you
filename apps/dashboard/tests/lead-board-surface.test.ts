import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lib = readFileSync(join(__dirname, "..", "src", "lib", "lead-board.ts"), "utf8");

/**
 * The lead board's columns say who is in them in the customer's own words.
 */
describe("the lead board columns", () => {
  it("never tells a reader that a no, or an opt-out, belongs in Disqualified", () => {
    // Disqualified is "not our target" and nothing else. A no about the moment stays in
    // Leads and an opt-out has its own column, so a blurb naming either of them here
    // describes a board that does not exist.
    const disqualified = lib.slice(
      lib.indexOf('key: "disqualified"'),
      lib.indexOf('key: "opt_out"'),
    );
    expect(disqualified).not.toContain("said no");
    expect(disqualified).not.toContain("opted out");
    expect(disqualified).not.toContain("cannot buy");
  });

  it("names the first column LEADS, because Contacted is a card's word now", () => {
    // "Contacted" is one of the delivery statuses a CARD wears (beside Sent,
    // Delivered, Bounced, Queued), so spending the column's name on it made the
    // heading and the cards under it argue about what the word meant.
    const first = lib.slice(lib.indexOf("export const LEAD_BOARD_COLUMNS"), lib.indexOf('key: "sales_interest"'));
    expect(first).toContain('key: "contacted"');
    expect(first).toContain('label: "Leads"');
    expect(first).not.toContain('label: "Contacted"');
  });

  it("keeps the four sentences the owner wrote", () => {
    for (const blurb of [
      "Individuals we have identified as potential clients.",
      "Leads who replied with interest.",
      "Individuals disqualified as leads for this {scope}.",
      "Leads who requested to be unsubscribed.",
    ]) {
      expect(lib).toContain(blurb);
    }
  });
});
