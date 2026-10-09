import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legCatalogueFromWire } from "../src/lib/legs";
import { recordedSinceText, skipReasonsText, skipReasonWords, triggerLinesFor } from "../src/lib/trigger-events";

// features-service `GET /public/channels` (owner 2026-10-09): reactive legs name their trigger.
const catalogue = legCatalogueFromWire({
  steps: [
    { key: "lead_found", label: "Lead found" },
    { key: "conversation", label: "Positive reply" },
    { key: "meeting_booked", label: "Meeting booked" },
    { key: "meeting_attended", label: "Meeting attended" },
  ],
  channels: [
    {
      slug: "sales-cold-email-outreach",
      stepTransitions: [{ legKey: "lead_found_to_conversation", from: { key: "lead_found" }, to: { key: "conversation" }, mode: "proactive", triggerId: null }],
    },
    {
      slug: "ai-meeting-booking",
      stepTransitions: [
        { legKey: "conversation_to_meeting_booked", from: { key: "conversation" }, to: { key: "meeting_booked" }, mode: "reactive", triggerId: "positive_reply_received" },
      ],
    },
    {
      slug: "agency-meeting-attendance",
      stepTransitions: [
        { legKey: "meeting_booked_to_meeting_attended", from: { key: "meeting_booked" }, to: { key: "meeting_attended" }, mode: "reactive", triggerId: "meeting_booked" },
      ],
    },
    {
      slug: "sourcing-apollo-cold-filters",
      stepTransitions: [{ legKey: "start_to_lead_found", to: { key: "lead_found" }, mode: "reactive", triggerId: "lead_requested" }],
    },
  ],
  triggers: [
    { id: "lead_requested", label: "Lead requested", description: "A campaign needs a new person to contact.", icon: "user-focus" },
    { id: "positive_reply_received", label: "Positive reply", description: "A prospect replied with interest.", icon: "thumbs-up" },
    { id: "meeting_booked", label: "Meeting booked", description: "A prospect booked a meeting.", icon: "calendar-check" },
  ],
});

const row = (triggerId: string, over: Partial<{ events: number; ran: number; skipped: number; pending: number; skippedByReason: Array<{ reason: string; count: number }> }> = {}) => ({
  triggerId,
  events: 0,
  ran: 0,
  skipped: 0,
  pending: 0,
  skippedByReason: [],
  lastOccurredAt: null,
  ...over,
});

describe("triggerLinesFor", () => {
  it("an ON reactive campaign's trigger reads at zero when it has no event yet, never omitted", () => {
    const lines = triggerLinesFor([{ featureSlug: "ai-meeting-booking", legKey: "conversation_to_meeting_booked", on: true }], catalogue, []);
    expect(lines.map((l) => [l.trigger.label, l.counts])).toEqual([["Positive reply", null]]);
  });

  it("carries the served counts of the trigger", () => {
    const served = row("positive_reply_received", { events: 12, ran: 9, skipped: 3, skippedByReason: [{ reason: "campaign_off", count: 3 }] });
    const [line] = triggerLinesFor([{ featureSlug: "ai-meeting-booking", legKey: "conversation_to_meeting_booked", on: true }], catalogue, [served]);
    expect(line.counts).toBe(served);
  });

  it("an OFF campaign's trigger shows only once it fired (its events say why they were skipped)", () => {
    const off = [{ featureSlug: "agency-meeting-attendance", legKey: "meeting_booked_to_meeting_attended", on: false }];
    expect(triggerLinesFor(off, catalogue, [])).toEqual([]);
    expect(triggerLinesFor(off, catalogue, [row("meeting_booked", { events: 2, skipped: 2 })]).map((l) => l.trigger.id)).toEqual(["meeting_booked"]);
  });

  it("a proactive campaign waits on no trigger, and a trigger no listed campaign names is the other table's", () => {
    const lines = triggerLinesFor(
      [{ featureSlug: "sales-cold-email-outreach", legKey: "lead_found_to_conversation", on: true }],
      catalogue,
      [row("lead_requested", { events: 40, ran: 40 })],
    );
    expect(lines).toEqual([]);
  });

  it("lists triggers in the catalogue's order, one line per trigger whatever the campaigns", () => {
    const lines = triggerLinesFor(
      [
        { featureSlug: "agency-meeting-attendance", legKey: "meeting_booked_to_meeting_attended", on: true },
        { featureSlug: "ai-meeting-booking", legKey: "conversation_to_meeting_booked", on: true },
        { featureSlug: "sourcing-apollo-cold-filters", legKey: "start_to_lead_found", on: true },
      ],
      catalogue,
      [],
    );
    expect(lines.map((l) => l.trigger.id)).toEqual(["lead_requested", "positive_reply_received", "meeting_booked"]);
  });
});

describe("skip reasons in plain words", () => {
  it("a known code reads in plain English", () => {
    expect(skipReasonWords("campaign_off")).toEqual({ text: "campaign off", known: true });
    expect(skipReasonWords("item_budget_reached").text).toBe("campaign budget reached");
  });

  it("an unknown code renders the code itself, flagged unknown (the line logs it), never dropped", () => {
    expect(skipReasonWords("brand_new_code")).toEqual({ text: "brand_new_code", known: false });
  });

  it("one reason alone has no count; several carry their served counts; past two, +N more", () => {
    expect(skipReasonsText([{ reason: "campaign_off", count: 3 }])).toBe("campaign off");
    expect(skipReasonsText([{ reason: "campaign_off", count: 2 }, { reason: "unfunded", count: 1 }])).toBe("campaign off 2, no funds 1");
    expect(
      skipReasonsText([
        { reason: "campaign_off", count: 2 },
        { reason: "unfunded", count: 1 },
        { reason: "run_in_flight", count: 1 },
      ]),
    ).toBe("campaign off 2, no funds 1, +1 more");
    expect(skipReasonsText([])).toBeNull();
  });
});

describe("since recording began", () => {
  it("dates the line by recordedSince, the year only when it is not this year", () => {
    const now = new Date("2026-10-09T18:00:00Z");
    expect(recordedSinceText("2026-10-09T15:49:36.675Z", now)).toBe("Oct 9");
    expect(recordedSinceText("2025-03-02T12:00:00Z", now)).toBe("Mar 2, 2025");
  });
});

const src = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

describe("wiring", () => {
  it("the reader asks the whole history (no 7/30-day window) and safeParses", () => {
    const api = src("lib/api.ts");
    const at = api.indexOf("export async function getOfferTriggerEventsSummary(");
    const fn = api.slice(at, api.indexOf("\n}\n", at));
    expect(fn).toContain("/trigger-events/summary");
    expect(fn).toContain("from: TRIGGER_EVENTS_SINCE_INCEPTION");
    expect(fn).toContain("OfferTriggerEventsSummarySchema.safeParse(raw)");
    expect(api).toContain('TRIGGER_EVENTS_SINCE_INCEPTION = "1970-01-01T00:00:00.000Z"');
  });

  it("the lines sit under the campaign rows of both tables (Sales path and Sourcing share OfferCampaigns)", () => {
    const table = src("components/v2/offer-campaigns.tsx");
    expect(table).toContain("<TriggerEventLines brandId={brandId} offerId={offerId} campaigns={triggerCampaigns} catalogue={catalogue} />");
    expect(table).toContain("on: running(c)");
  });

  it("the read polls, persists, and a failure is a stated sentence, not an empty line", () => {
    const lines = src("components/v2/trigger-event-lines.tsx");
    expect(lines).toContain('["offerTriggerEventsSummary", brandId, offerId]');
    expect(lines).toContain("pollOptions");
    expect(lines).toContain("Could not load how often the triggers fired.");
    expect(src("lib/persist-cache.ts")).toContain('"offerTriggerEventsSummary"');
  });
});
