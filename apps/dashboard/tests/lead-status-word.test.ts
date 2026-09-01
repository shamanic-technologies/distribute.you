import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leadStatusLabel, leadStatusTone } from "../src/lib/lead-status";
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

  it("calls a click a WEBSITE VISIT, which is what the board's Sales-interest card reads", () => {
    // The whole point of the tag change: a card in Sales interest states the evidence
    // that put it there, not the column's own name repeated back.
    expect(leadStatusLabel("clicked")).toBe("Website visit");
  });

  it("calls the push QUEUED, never Contacted", () => {
    // Handing a lead to Instantly is not reaching them — it dispatches on weekdays
    // inside the recipient's business hours, so the state outlives the push by days.
    // And "Contacted" is a word the board now spends on a card, not on a column.
    expect(leadStatusLabel("contacted")).toBe("Queued");
  });

  it("tones a bounce NEGATIVE although the lead stays in play", () => {
    // The address needs repairing and that is the one thing on the card worth acting
    // on — the column it sits in says whether the person is still a prospect.
    expect(leadStatusTone("bounced")).toBe("negative");
    expect(leadStatusTone("unsubscribed")).toBe("negative");
  });

  it("tones the two signals a campaign is bought on POSITIVE", () => {
    expect(leadStatusTone("clicked")).toBe("positive");
    expect(leadStatusTone("replied")).toBe("positive");
  });

  it("leaves every waiting state NEUTRAL rather than reading as a step cleared", () => {
    for (const status of ["delivered", "sent", "contacted", "served", "buffered"] as const) {
      expect(leadStatusTone(status)).toBe("neutral");
    }
  });

  it("answers for EVERY status, so a new one cannot ship unnamed", () => {
    // Both are exhaustive switches over `LeadConsolidatedStatus` with no default, so
    // tsc catches an addition; this pins that neither has grown a silent fallback.
    const src = readFileSync(join(__dirname, "..", "src", "lib", "lead-status.ts"), "utf8");
    expect(src).not.toContain("default:");
    for (const status of EVERY) {
      expect(leadStatusTone(status)).toBeTruthy();
    }
  });

  it("draws its tones from the tints the dark remap actually covers", () => {
    // The table's own palette is eleven hues (emerald / violet / cyan / amber /
    // slate …) and is remapped for dark almost nowhere. The card reads the four
    // reply-kind tones instead, every one of which is in the closed set — bringing the
    // table's palette to a second surface would spread a light-mode-only look.
    const globals = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    const board = readFileSync(join(__dirname, "..", "src", "components", "leads", "lead-board.tsx"), "utf8");
    expect(board).toContain("REPLY_TONE_PILL[tag.tone]");
    expect(board).not.toContain("leadStatusStyle");
    for (const cls of ["bg-green-50", "bg-red-50", "text-green-700", "border-red-200"]) {
      expect(globals).toContain(`html.dark .${cls}`);
    }
  });
});
