import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LeadHistorySchema,
  hasReadableBody,
  incompleteNote,
  sequenceStopped,
  sourceLabel,
  unavailableSources,
  type LeadHistory,
} from "../src/lib/lead-history";

/**
 * REAL unit tests — `lib/lead-history.ts` imports only zod, so it runs under vitest
 * (which does not resolve the `@` alias here). Keep it alias-free.
 */
const base = (over: Partial<LeadHistory> = {}): LeadHistory =>
  LeadHistorySchema.parse({
    leadCampaignId: "r1",
    leadId: "l1",
    campaignId: "c1",
    brandId: "b1",
    email: "jason@example.com",
    scope: "campaign",
    campaignIds: ["c1"],
    campaignsTruncated: false,
    complete: true,
    sources: [{ source: "outreach", status: "ok", reason: null }],
    events: [],
    ...over,
  });

const event = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  at: "2026-09-02T18:50:55.000Z",
  type: "message",
  evidence: "observed",
  source: "mailbox",
  campaignId: "c1",
  direction: "inbound",
  ...over,
});

describe("LeadHistorySchema", () => {
  // The producer widens these vocabularies as the fleet grows. A `z.enum` throws the
  // whole panel the day it gains a word, which is the rot that took another page down.
  it("accepts a type, an evidence and a source this build has never seen", () => {
    const parsed = LeadHistorySchema.safeParse(
      base({ events: [event({ type: "carrier_pigeon", evidence: "rumoured", source: "fax" })] }),
    );
    expect(parsed.success).toBe(true);
  });

  // The producer serves more per type than any one surface renders, and adds more.
  it("keeps a field this build does not declare", () => {
    const parsed = LeadHistorySchema.parse(base({ events: [event({ somethingNew: 7 })] }));
    expect((parsed.events[0] as Record<string, unknown>).somethingNew).toBe(7);
  });

  // A body that stops carrying a required field must fail loudly rather than read as a
  // fact that did not happen.
  it("refuses a body missing a required field", () => {
    const { events, ...rest } = base();
    expect(LeadHistorySchema.safeParse(rest).success).toBe(false);
    expect(events).toEqual([]);
  });
});

describe("hasReadableBody", () => {
  it("shows the words when there are words", () => {
    expect(hasReadableBody(event({ bodyText: "I would be interested.", bodyStatus: "ok" }))).toBe(true);
  });

  // `empty` and `unavailable` are DIFFERENT answers, and neither is "here are the
  // words". A message we hold and could not read must never render as an empty one.
  it("shows nothing for a body the holder could not read, or one that says nothing", () => {
    expect(hasReadableBody(event({ bodyText: null, bodyStatus: "unavailable" }))).toBe(false);
    expect(hasReadableBody(event({ bodyText: "", bodyStatus: "empty" }))).toBe(false);
    // Even with text on it: the status is what decides, not the string.
    expect(hasReadableBody(event({ bodyText: "x", bodyStatus: "unavailable" }))).toBe(false);
  });

  it("shows nothing for an event that carries no body at all", () => {
    expect(hasReadableBody(event({ type: "delivery", milestone: "delivered" }))).toBe(false);
  });
});

describe("incompleteNote", () => {
  // "We could not read this" and "this did not happen" are different facts, and a
  // history that silently drops a source tells a customer their prospect said nothing.
  it("names what could not be read", () => {
    const note = incompleteNote(
      base({
        complete: false,
        sources: [
          { source: "mailbox", status: "unavailable", reason: "token expired" },
          { source: "outreach", status: "ok", reason: null },
        ],
      }),
    );
    expect(note).toContain("your mailbox");
  });

  it("lists several in one sentence", () => {
    const note = incompleteNote(
      base({
        complete: false,
        sources: [
          { source: "mailbox", status: "unavailable", reason: null },
          { source: "delivery", status: "unavailable", reason: null },
        ],
      }),
    );
    expect(note).toContain("your mailbox and delivery tracking");
  });

  // A capped answer must never look like a whole one.
  it("says so when the campaign fan-out was bounded", () => {
    expect(incompleteNote(base({ complete: false, campaignsTruncated: true }))).toContain(
      "more campaigns",
    );
  });

  // `not_asked` is not a failure: there was nothing in scope to ask about.
  it("says nothing when every source answered", () => {
    expect(incompleteNote(base())).toBeNull();
    expect(
      incompleteNote(base({ sources: [{ source: "content", status: "not_asked", reason: "no email" }] })),
    ).toBeNull();
    expect(incompleteNote(null)).toBeNull();
  });

  it("names an unknown source as itself rather than inventing words for it", () => {
    expect(sourceLabel("something-new")).toBe("something-new");
    expect(unavailableSources(base())).toEqual([]);
  });
});

describe("sequenceStopped", () => {
  // Read off the producer's own follow-up state. The browser guessing it from an
  // inbound message is what promised two more follow-ups to a prospect who had already
  // answered.
  it("reads the producer's follow-up state", () => {
    expect(
      sequenceStopped(
        base({ events: [event({ type: "followup", state: "stopped", stoppedReason: "replied" })] }),
      ),
    ).toBe(true);
    expect(
      sequenceStopped(base({ events: [event({ type: "followup", state: "scheduled" })] })),
    ).toBe(false);
    expect(sequenceStopped(base())).toBe(false);
  });
});

describe("the panel derives nothing of its own", () => {
  const timeline = readFileSync(
    join(__dirname, "..", "src", "components", "audiences", "lead-history-timeline.tsx"),
    "utf8",
  );

  // Ordering, de-duplication and which fact outranks which are the producer's. Doing
  // any of them here rebuilds the bug one layer up.
  it("neither sorts nor de-duplicates nor filters the events", () => {
    expect(timeline).not.toContain(".sort(");
    expect(timeline).not.toContain(".filter(");
    expect(timeline).toContain("events.map(");
  });

  // A type this build does not know renders nothing rather than a guess at the nearest
  // one it does.
  it("renders nothing for a type it does not know", () => {
    expect(timeline).toContain("if (!shape) return null;");
  });
});
