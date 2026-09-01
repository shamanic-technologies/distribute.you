import { describe, expect, it, vi } from "vitest";
import { parseLeadsResponse } from "../src/lib/api";
import { leadBoardColumnFor } from "../src/lib/lead-board";

/**
 * A REAL row off the wire, byte-shaped like the one measured on campaign
 * `9e28ba26-1cd3-4b52-9d00-b73e900522ae` (Form Magnet, 1,898 rows), trimmed to the
 * fields `LeadDeliverySchema` names plus the `standing` this is about.
 *
 * The point of a fixture rather than a schema read: a too-narrow `z.object()` STRIPS
 * an undeclared field silently, so the only way to know `standing` reaches a consumer
 * is to run the parser and look at what came out. This repo has recorded that failure
 * three times.
 */
const row = (over: Record<string, unknown> = {}) => ({
  id: "row-1",
  email: "sara@cascobay.com",
  status: "served",
  contacted: true,
  sent: true,
  delivered: true,
  clicked: true,
  bounced: false,
  unsubscribed: false,
  replied: false,
  replyClassification: null,
  standing: {
    funnelKey: "form_magnet",
    entryStep: "website_visit",
    entryMeasure: "delivery_click",
    reachedEntryStep: true,
    deepestStep: "website_visit",
    at: null,
    state: "sales_interest",
    signal: "measured_visit",
    origin: "measured",
    reason: null,
  },
  ...over,
});

describe("`standing` reaches the board through the real parser", () => {
  it("survives the parse whole, every field of it", () => {
    const { leads } = parseLeadsResponse({ leads: [row()] }, "test");
    const standing = leads[0].standing;
    expect(standing).toBeTruthy();
    // The two the board dereferences...
    expect(standing?.state).toBe("sales_interest");
    expect(standing?.signal).toBe("measured_visit");
    // ...and the eight it does not, which must not be stripped either: they are what
    // a later surface reads, and a stripped field reads as "the producer sent none".
    expect(standing?.funnelKey).toBe("form_magnet");
    expect(standing?.entryStep).toBe("website_visit");
    expect(standing?.entryMeasure).toBe("delivery_click");
    expect(standing?.reachedEntryStep).toBe(true);
    expect(standing?.deepestStep).toBe("website_visit");
    expect(standing?.origin).toBe("measured");
    expect(standing?.reason).toBeNull();
    expect(standing?.at).toBeNull();
  });

  it("places the parsed row where the producer said, end to end", () => {
    const { leads } = parseLeadsResponse({ leads: [row()] }, "test");
    // The 67 leads that read as an empty Sales-interest column while this app derived
    // interest from a reply signal.
    expect(leadBoardColumnFor(leads[0].standing)).toBe("sales_interest");
  });

  it("parses every state the campaign actually produced", () => {
    const measured = [
      { state: "contacted", signal: "contacted", column: "contacted" },
      { state: "disqualified", signal: "bounced", column: "disqualified" },
      { state: "sales_interest", signal: "measured_visit", column: "sales_interest" },
      { state: "disqualified", signal: "negative_reply", column: "disqualified" },
      { state: "not_contacted", signal: "none", column: null },
    ] as const;
    for (const m of measured) {
      const { leads } = parseLeadsResponse(
        { leads: [row({ standing: { ...row().standing, state: m.state, signal: m.signal } })] },
        "test",
      );
      expect(leadBoardColumnFor(leads[0].standing)).toBe(m.column);
    }
  });

  it("keeps parsing a state this build does not name, rather than throwing the page", () => {
    // lead-service owns the vocabulary and can widen it before this app ships. A
    // `z.enum` here would turn a state it ADDS into a thrown parse, which
    // reveal-on-settle paints as headings with nothing under them.
    const { leads } = parseLeadsResponse(
      { leads: [row({ standing: { ...row().standing, state: "something_new" } })] },
      "test",
    );
    expect(leads[0].standing?.state).toBe("something_new");
    expect(leadBoardColumnFor(leads[0].standing)).toBe("unresolved");
  });

  it("parses a body written before the producer served it at all", () => {
    // A snapshot restored from the local-first cache, in practice.
    const { standing: _drop, ...older } = row();
    const { leads } = parseLeadsResponse({ leads: [older] }, "test");
    expect(leads[0].standing).toBeUndefined();
    expect(leadBoardColumnFor(leads[0].standing)).toBe("unresolved");
  });

  it("throws on a standing whose own shape is wrong", () => {
    // The loud half: a 200 carrying a broken standing must fail rather than place
    // every card in "Not placed", which would read as a producer outage.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      parseLeadsResponse({ leads: [row({ standing: { state: 7, signal: null } })] }, "test"),
    ).toThrow();
    spy.mockRestore();
  });
});
