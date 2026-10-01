import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leadStatusLabel } from "../src/lib/lead-status";
import type { LeadConsolidatedStatus } from "../src/lib/api";

const EVERY: LeadConsolidatedStatus[] = [
  "replied",
  "clicked",
  "delivered",
  "sent",
  "bounced",
  "unsubscribed",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
];

describe("one status word, read by the table, the CSV and the board card", () => {
  it("names every status a customer can be shown", () => {
    for (const status of EVERY) {
      expect(leadStatusLabel(status).length).toBeGreaterThan(2);
    }
  });

  it("calls a click a WEBSITE VISIT, which is what the board's Positive-reply card reads", () => {
    // The whole point of the tag change: a card in Positive reply states the evidence
    // that put it there, not the column's own name repeated back.
    expect(leadStatusLabel("clicked")).toBe("Website visit");
  });

  it("calls the push QUEUED, never Contacted", () => {
    // Handing a lead to Instantly is not reaching them — it dispatches on weekdays
    // inside the recipient's business hours, so the state outlives the push by days.
    // And "Contacted" is a word the board now spends on a card, not on a column.
    expect(leadStatusLabel("contacted")).toBe("Queued");
  });

  it("answers for EVERY status, so a new one cannot ship unnamed", () => {
    // An exhaustive switch over `LeadConsolidatedStatus` with no default, so tsc
    // catches an addition; this pins that it has not grown a silent fallback.
    const src = readFileSync(join(__dirname, "..", "src", "lib", "lead-status.ts"), "utf8");
    expect(src).not.toContain("default:");
    for (const status of EVERY) {
      expect(leadStatusLabel(status)).toBeTruthy();
    }
  });
});

