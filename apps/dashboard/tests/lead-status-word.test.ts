import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leadStatusLabel, leadStatusPill } from "../src/lib/lead-status";
import { REPLY_KIND_PILL, REPLY_KINDS, replyKindPill } from "../src/lib/reply-kind";
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

  it("answers for EVERY status, so a new one cannot ship unnamed", () => {
    // Both are exhaustive switches over `LeadConsolidatedStatus` with no default, so
    // tsc catches an addition; this pins that neither has grown a silent fallback.
    const src = readFileSync(join(__dirname, "..", "src", "lib", "lead-status.ts"), "utf8");
    expect(src).not.toContain("default:");
    for (const status of EVERY) {
      expect(leadStatusPill(status)).toBeTruthy();
    }
  });
});

describe("one colour per tag, and the hue says which tag", () => {
  it("gives every status its OWN pill — no two share one without meaning to", () => {
    // A column of eleven identical grey chips is a column that says nothing. The only
    // deliberate pairs are the two inert ones.
    const byPill = new Map<string, string[]>();
    for (const s of EVERY) {
      const p = leadStatusPill(s);
      byPill.set(p, [...(byPill.get(p) ?? []), s]);
    }
    const shared = [...byPill.values()].filter((g) => g.length > 1).map((g) => g.sort().join("+"));
    // Nothing has happened to either yet, and neither is ours to act on.
    expect(shared.sort()).toEqual(["buffered+claimed", "contacted+served"]);
  });

  it("keeps the observed family COOL, so it never reads as something a person said", () => {
    // The whole system in one line: cool = what we did and the delivery layer measured,
    // warm/green = what a person stated. On a board card one replaces the other, so a
    // reader must never have to work out which they are looking at.
    for (const s of ["sent", "delivered", "clicked", "replied", "contacted", "buffered"] as const) {
      expect(leadStatusPill(s)).toMatch(/blue|sky|cyan|teal|slate|stone/);
    }
  });

  it("walks the sweep outward as the lead engages, and never doubles back", () => {
    const order = ["buffered", "contacted", "sent", "delivered", "clicked", "replied"] as const;
    const hues = ["stone", "slate", "blue", "sky", "cyan", "teal"];
    order.forEach((status, i) => {
      expect(leadStatusPill(status)).toContain(`bg-${hues[i]}-100`);
    });
  });

  it("warns a bounce and condemns only an opt-out", () => {
    // A bounce is a failure of DELIVERY — the lead stays in play (lead-service v0.65.0),
    // so a red chip would say the opposite of the column it sits in.
    expect(leadStatusPill("bounced")).toContain("orange");
    expect(leadStatusPill("bounced")).not.toContain("red");
    expect(leadStatusPill("unsubscribed")).toContain("red");
  });

  it("gives every reply KIND its own colour, not one per tone", () => {
    // Four greens meaning four different things is what this replaces: the vocabulary
    // split four ways on the positive side precisely because "positive" cannot separate
    // "interested but not the buyer" from "wants to book".
    const positives = REPLY_KINDS.filter((o) => o.tone === "positive").map((o) => REPLY_KIND_PILL[o.kind]);
    expect(new Set(positives).size).toBe(positives.length);
    // Every kind the catalogue carries is coloured.
    for (const o of REPLY_KINDS) expect(REPLY_KIND_PILL[o.kind]).toBeTruthy();
  });

  it("ramps the intent: wants-to-book is the deepest green, a permanent no the red end", () => {
    expect(REPLY_KIND_PILL.lead_meeting_requested).toContain("emerald");
    expect(REPLY_KIND_PILL.lead_interested).toContain("green");
    expect(REPLY_KIND_PILL.lead_info_requested).toContain("lime");
    // A no about the MOMENT is warned; a no about the PERSON is the red end.
    expect(REPLY_KIND_PILL.lead_not_interested).toContain("amber");
    expect(REPLY_KIND_PILL.lead_wrong_person).toContain("rose");
    // A referral is real value and NOT this person's intent, so it sits off the ramp.
    expect(REPLY_KIND_PILL.lead_referral).toContain("violet");
    // Not a person at all: the dimmest pair, and the only two that share a colour.
    expect(REPLY_KIND_PILL.lead_out_of_office).toBe(REPLY_KIND_PILL.auto_reply_received);
    expect(REPLY_KIND_PILL.lead_out_of_office).toContain("stone");
  });

  it("keeps the two families DISJOINT, so a stated kind cannot read as a status", () => {
    const hue = (cls: string) => cls.match(/bg-([a-z]+)-/)?.[1] ?? "";
    const statuses = new Set(EVERY.map((s) => hue(leadStatusPill(s))));
    const kinds = new Set(REPLY_KINDS.map((o) => hue(REPLY_KIND_PILL[o.kind])));
    const overlap = [...kinds].filter((h) => statuses.has(h)).sort();
    // Only the two inert tones are shared, and they mean the same thing in both:
    // nothing to read here.
    expect(overlap).toEqual(["slate", "stone"]);
  });

  it("falls back to a neutral pill for a kind the producer added and we cannot colour", () => {
    // A kind we have no label for is not a reason to draw nothing.
    expect(replyKindPill("lead_something_new")).toBeTruthy();
    expect(replyKindPill(null)).toBeTruthy();
  });

  it("draws every tint from the set the dark layer answers for", () => {
    // The card used to take the four reply tones precisely BECAUSE this palette had no
    // dark rules. #3813 closed that by hue, which is what lets both families be used.
    const globals = readFileSync(join(__dirname, "..", "src", "app", "globals.css"), "utf8");
    const pills = [...EVERY.map(leadStatusPill), ...REPLY_KINDS.map((o) => REPLY_KIND_PILL[o.kind])];
    for (const cls of new Set(pills.flatMap((p) => p.split(" ")))) {
      if (cls.includes("-gray-")) continue; // the neutral ramp has its own remap layer
      expect(globals, `${cls} has no html.dark rule`).toContain(`html.dark .${cls} `);
    }
  });

  it("is drawn through the ONE palette on every surface that shows a status", () => {
    const page = readFileSync(join(__dirname, "..", "src", "components", "audiences", "engaged-leads-page.tsx"), "utf8");
    const board = readFileSync(join(__dirname, "..", "src", "components", "leads", "lead-board.tsx"), "utf8");
    const control = readFileSync(join(__dirname, "..", "src", "components", "leads", "reply-kind-control.tsx"), "utf8");
    // The table badge and the board card.
    expect(page).toContain("${leadStatusPill(status)}");
    expect(page).toContain("statusPill: leadStatusPill(status)");
    expect(board).toContain("pill: replyKindPill(stated.kind)");
    expect(board).toContain("${tag.pill}");
    // The panel's own pill and its picker rows.
    expect(control).toContain("${replyKindPill(option.kind)}");
    expect(control).toContain("${replyKindPill(o.kind)}");
    // The table's private eleven-hue copy is gone.
    expect(page).not.toContain("function leadStatusStyle(");
    for (const src of [page, board, control]) expect(src).not.toContain("REPLY_TONE_PILL[");
  });
});
