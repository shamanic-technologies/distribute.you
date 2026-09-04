import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  conversationRefusal,
  hasInbound,
  sequenceStopNote,
  sequenceStopReason,
  messageLabel,
  orderedMessages,
  unsentFollowUps,
  type ConversationMessage,
} from "../src/lib/lead-conversation";

function msg(over: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    direction: "outbound",
    from: "us@agency.test",
    to: "them@acme.test",
    at: "2026-08-01T10:00:00.000Z",
    subject: "Quick question",
    text: "Hello there",
    ...over,
  };
}

describe("orderedMessages", () => {
  it("puts the exchange oldest first", () => {
    const out = orderedMessages([
      msg({ at: "2026-08-03T10:00:00.000Z", text: "third" }),
      msg({ at: "2026-08-01T10:00:00.000Z", text: "first" }),
      msg({ at: "2026-08-02T10:00:00.000Z", text: "second" }),
    ]);
    expect(out.map((m) => m.text)).toEqual(["first", "second", "third"]);
  });

  it("keeps the producer's order for two messages sharing an instant", () => {
    const out = orderedMessages([
      msg({ at: "2026-08-01T10:00:00.000Z", text: "ours" }),
      msg({ at: "2026-08-01T10:00:00.000Z", text: "theirs", direction: "inbound" }),
    ]);
    expect(out.map((m) => m.text)).toEqual(["ours", "theirs"]);
  });

  it("drops a message the source could not date — it has no place in a chronology", () => {
    const out = orderedMessages([msg({ at: "" }), msg({ at: "2026-08-01T10:00:00.000Z" })]);
    expect(out).toHaveLength(1);
  });

  it("drops a message carrying neither subject nor body", () => {
    const out = orderedMessages([msg({ subject: "   ", text: "  " }), msg()]);
    expect(out).toHaveLength(1);
  });

  it("keeps a message that has a subject but no body", () => {
    const out = orderedMessages([msg({ text: "", subject: "Re: Quick question" })]);
    expect(out).toHaveLength(1);
  });
});

describe("messageLabel", () => {
  it("names the first thing we sent the initial email", () => {
    const ordered = orderedMessages([msg()]);
    expect(messageLabel(ordered, 0)).toBe("Initial email");
  });

  it("names a later send a follow-up while the prospect has said nothing", () => {
    const ordered = orderedMessages([
      msg({ at: "2026-08-01T10:00:00.000Z" }),
      msg({ at: "2026-08-04T10:00:00.000Z" }),
    ]);
    expect(messageLabel(ordered, 1)).toBe("Follow-up");
  });

  it("names an inbound message their reply", () => {
    const ordered = orderedMessages([
      msg({ at: "2026-08-01T10:00:00.000Z" }),
      msg({ at: "2026-08-02T10:00:00.000Z", direction: "inbound" }),
    ]);
    expect(messageLabel(ordered, 1)).toBe("Their reply");
  });

  it("names anything we send after a reply an answer, not another follow-up", () => {
    const ordered = orderedMessages([
      msg({ at: "2026-08-01T10:00:00.000Z" }),
      msg({ at: "2026-08-02T10:00:00.000Z", direction: "inbound" }),
      msg({ at: "2026-08-03T10:00:00.000Z" }),
    ]);
    expect(messageLabel(ordered, 2)).toBe("Our reply");
  });

  it("returns nothing for an index the list does not hold", () => {
    expect(messageLabel([], 0)).toBe("");
  });
});

describe("hasInbound", () => {
  it("is true once the prospect has written", () => {
    expect(hasInbound([msg(), msg({ direction: "inbound" })])).toBe(true);
  });

  it("is false when only we have written", () => {
    expect(hasInbound([msg(), msg()])).toBe(false);
  });

  it("is false for an inbound message we cannot place — it is not on screen", () => {
    expect(hasInbound([msg({ direction: "inbound", at: "" })])).toBe(false);
  });

  it("is false for an empty exchange", () => {
    expect(hasInbound([])).toBe(false);
  });
});

describe("unsentFollowUps", () => {
  const now = new Date("2026-08-10T00:00:00.000Z").getTime();

  it("keeps only the steps still ahead", () => {
    const out = unsentFollowUps(
      [
        { at: "2026-08-05T00:00:00.000Z", step: 2 },
        { at: "2026-08-15T00:00:00.000Z", step: 3 },
      ],
      now,
    );
    expect(out.map((f) => f.step)).toEqual([3]);
  });

  it("drops an undated row — nothing places it in the future", () => {
    expect(unsentFollowUps([{ at: "" }], now)).toEqual([]);
  });

  it("drops an unparseable date rather than treating it as scheduled", () => {
    expect(unsentFollowUps([{ at: "not-a-date" }], now)).toEqual([]);
  });

  it("drops a step landing exactly now — it is no longer ahead", () => {
    expect(unsentFollowUps([{ at: "2026-08-10T00:00:00.000Z" }], now)).toEqual([]);
  });
});

describe("conversationRefusal", () => {
  it("reads the producer's 404 as absent", () => {
    expect(conversationRefusal({ status: 404 })).toBe("absent");
  });

  it("reads the producer's 502 as unavailable", () => {
    expect(conversationRefusal({ status: 502 })).toBe("unavailable");
  });

  it("returns null for any other failure so the caller re-throws it", () => {
    expect(conversationRefusal({ status: 500 })).toBeNull();
    expect(conversationRefusal(new Error("boom"))).toBeNull();
    expect(conversationRefusal(null)).toBeNull();
  });
});

describe("the module stays alias-free", () => {
  it("imports nothing through the @ alias, so these are real unit tests", () => {
    const src = readFileSync(
      join(__dirname, "../src/lib/lead-conversation.ts"),
      "utf8",
    );
    expect(src).not.toContain('from "@/');
  });
});

/**
 * WHY nothing more will be sent — the rule the timeline reads before listing a
 * follow-up as `scheduled`.
 *
 * instantly-service creates every campaign with `stop_on_reply: true`, so the sequence
 * really does end on a reply; promising two more sends after that is the status-label
 * bug one surface over.
 */
describe("sequenceStopReason", () => {
  it("stops on a reply, an unsubscribe and a bounce", () => {
    expect(sequenceStopReason({ firstRepliedAt: "2026-09-04T10:00:00Z" })).toBe("replied");
    expect(sequenceStopReason({ firstUnsubscribedAt: "2026-09-04T10:00:00Z" })).toBe(
      "unsubscribed",
    );
    expect(sequenceStopReason({ firstBouncedAt: "2026-09-04T10:00:00Z" })).toBe("bounced");
  });

  // The one that matters most, and the case that was reported: link tracking is on and
  // nothing in the provider's config stops a sequence on a click, so the follow-ups
  // really are still coming. Dropping them there would hide a send about to be paid for.
  it("does NOT stop on a website visit", () => {
    expect(sequenceStopReason({ firstRepliedAt: null, firstBouncedAt: null })).toBeNull();
    expect(sequenceStopReason({})).toBeNull();
    expect(sequenceStopReason(null)).toBeNull();
  });

  // The prospect's own instruction outranks the rest as the REASON, even when they also
  // replied — that is the sentence a customer needs to read.
  it("prefers the unsubscribe when several are on record", () => {
    expect(
      sequenceStopReason({
        firstRepliedAt: "2026-09-01T10:00:00Z",
        firstBouncedAt: "2026-09-02T10:00:00Z",
        firstUnsubscribedAt: "2026-09-03T10:00:00Z",
      }),
    ).toBe("unsubscribed");
  });

  it("says why, in its own words per reason", () => {
    const notes = (["replied", "unsubscribed", "bounced"] as const).map(sequenceStopNote);
    expect(new Set(notes).size).toBe(3);
    for (const note of notes) expect(note.length).toBeGreaterThan(0);
    // No em-dash in customer-facing copy.
    for (const note of notes) expect(note).not.toContain("\u2014");
  });
});
