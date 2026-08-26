import { describe, expect, it } from "vitest";
import {
  REPLY_KINDS,
  REPLY_TONE_LABEL,
  REPLY_TONE_ORDER,
  REPLY_TONE_PILL,
  replyKindOption,
  replyKindsByTone,
} from "../src/lib/reply-kind";

describe("reply kinds", () => {
  it("carries instantly-service's vocabulary value for value", () => {
    // It owns this list. A value invented here would be 400'd on the write, and a
    // value missing here silently cannot be stated.
    expect(REPLY_KINDS.map((o) => o.kind).sort()).toEqual(
      [
        "auto_reply_received",
        "lead_info_requested",
        "lead_interested",
        "lead_meeting_requested",
        "lead_neutral",
        "lead_not_interested",
        "lead_out_of_office",
        "lead_referral",
        "lead_wrong_person",
      ].sort(),
    );
  });

  it("splits the positive case four ways", () => {
    // "Positive" alone cannot separate "interested but not the buyer" from "wants to
    // book", which is the distinction the reader acts on.
    expect(replyKindsByTone("positive").map((o) => o.kind)).toEqual([
      "lead_interested",
      "lead_info_requested",
      "lead_meeting_requested",
      "lead_referral",
    ]);
  });

  it("carries NO deal-progress value", () => {
    // A booked meeting and a paid client are facts about the DEAL, stated on the funnel
    // stages in the same panel. Putting them here is what let one statement destroy the
    // other before the split.
    const kinds = REPLY_KINDS.map((o) => o.kind) as string[];
    expect(kinds).not.toContain("lead_meeting_booked");
    expect(kinds).not.toContain("lead_closed");
  });

  it("distinguishes asking for a call from a meeting existing", () => {
    const asked = replyKindOption("lead_meeting_requested");
    expect(asked?.tone).toBe("positive");
    expect(asked?.label).toBe("Wants to book");
  });

  it("returns null for a kind this build does not carry, never a fabricated label", () => {
    // instantly-service can widen the vocabulary before this app ships.
    expect(replyKindOption("lead_something_new")).toBeNull();
    expect(replyKindOption(null)).toBeNull();
    expect(replyKindOption(undefined)).toBeNull();
    expect(replyKindOption("")).toBeNull();
  });

  it("covers every tone with a heading, a pill and at least one kind", () => {
    for (const tone of REPLY_TONE_ORDER) {
      expect(REPLY_TONE_LABEL[tone]).toBeTruthy();
      expect(REPLY_TONE_PILL[tone]).toBeTruthy();
      expect(replyKindsByTone(tone).length).toBeGreaterThan(0);
    }
    expect(REPLY_KINDS.every((o) => REPLY_TONE_ORDER.includes(o.tone))).toBe(true);
  });

  it("uses only tints that exist in the html.dark remap", () => {
    // A colour outside that closed set renders its light-mode near-white on the dark
    // surface: invisible in the light default, so it ships unnoticed.
    const allowed = ["green", "red", "gray"];
    for (const tone of REPLY_TONE_ORDER) {
      for (const cls of REPLY_TONE_PILL[tone].split(" ")) {
        const colour = cls.split("-")[1];
        expect(allowed).toContain(colour);
      }
    }
  });

  it("carries no em-dash in any label", () => {
    for (const o of REPLY_KINDS) expect(o.label).not.toContain("—");
    for (const tone of REPLY_TONE_ORDER) expect(REPLY_TONE_LABEL[tone]).not.toContain("—");
  });
});
