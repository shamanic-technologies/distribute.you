import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ConversationTimelineSchema,
  conversationItemTag,
  furthestStepTag,
  joinConversationLabels,
  lastWordTag,
  liveItems,
} from "../src/lib/conversation-timeline";
import { PersonTimelineItemSchema, personLeadRowId } from "../src/lib/people-conversations";

// Christina Kennedy, as lead-service served her on 2026-10-08 (brand 75d7e3e8, offer d5ecba00).
const christina = {
  leadId: "8ee36bd6-a404-4799-bbdf-88a1b985a6f3",
  brandId: "75d7e3e8-6926-4f85-a557-976895400666",
  offerId: "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e",
  items: [
    {
      id: "reply:imap:14bcdd3f-4039-4cc3-8730-bfb9fc61641b",
      label: "not_interested",
      source: "reply",
      occurredAt: "2026-10-07T22:13:14.000Z",
      attributable: true,
      attributionBasis: "reaction_to_our_email",
      campaignId: "f7b1b610-4fa1-4b54-8fec-f7be124dc32b",
      offerId: "d5ecba00-783a-4939-b5bd-f85b9e6b7d9e",
      url: null,
      withdrawnAt: null,
      detail: { subject: "Re: patient acquisition in Mission Viejo", judgedBy: "model", classification: "negative" },
    },
  ],
  tags: { lastWord: "not_interested", lastWordAt: "2026-10-07T22:13:14.000Z", furthestStep: "contacted", furthestStepAttributable: true },
};

describe("a conversation's stored timeline, named not derived (owner 2026-10-08)", () => {
  it("parses lead-service's read as served", () => {
    expect(ConversationTimelineSchema.parse(christina).tags.lastWord).toBe("not_interested");
  });
  it("names Christina's conversation: last word Not interested, furthest step Contacted", () => {
    const t = ConversationTimelineSchema.parse(christina);
    expect(lastWordTag(t.tags.lastWord).label).toBe("Not interested");
    expect(furthestStepTag(t.tags.furthestStep)?.label).toBe("Contacted");
    expect(conversationItemTag(t.items[0].label).label).toBe("Not interested");
  });
  it("names every label lead-service serves today", () => {
    const labels = {
      initial_email: "Initial email", followup: "Followup", bounced: "Bounced", opened: "Opened",
      website_visit: "Website visit", link_click: "Link click", unsubscribed: "Unsubscribed",
      tagged_as_spam: "Tagged as spam", interested: "Interested", not_interested: "Not interested",
      question: "Question", hand_over: "Handed over", wrong_contact: "Wrong contact", opt_out: "Opt out",
      auto_reply: "Auto reply", reply: "Reply", signup: "Signup", form_filled: "Form filled",
      meeting_booked: "Meeting booked", meeting_attended: "Meeting attended", paid_client: "Paid client",
    };
    for (const [k, v] of Object.entries(labels)) expect(conversationItemTag(k).label).toBe(v);
    expect(furthestStepTag("paid_client")?.label).toBe("Paid client");
    expect(furthestStepTag(null)).toBeNull();
    expect(lastWordTag("no_reply").label).toBe("No reply");
  });
  it("keeps an unknown word, re-cased, in the neutral tone", () => {
    expect(conversationItemTag("demo_requested")).toEqual({ label: "Demo requested", tone: "neutral", icon: "dot" });
  });
  it("leaves out a fact its source took back", () => {
    const t = ConversationTimelineSchema.parse({
      ...christina,
      items: [...christina.items, { ...christina.items[0], id: "manual:x", withdrawnAt: "2026-10-08T00:00:00Z" }],
    });
    expect(liveItems(t).map((i) => i.id)).toEqual([christina.items[0].id]);
  });
  it("labels the thread item recorded at the same instant, and returns the facts nothing matched", () => {
    const thread = [
      { at: "2026-10-07T15:13:45.050Z" },
      { at: "2026-10-07T22:13:14.000Z" },
      { at: null },
    ];
    const extra = { ...christina.items[0], id: "manual:m1", label: "meeting_booked", source: "manual", occurredAt: "2026-10-09T10:00:00Z" };
    const { labels, unmatched } = joinConversationLabels(thread, [christina.items[0], extra]);
    expect(labels.map((l) => l?.label ?? null)).toEqual([null, "Not interested", null]);
    expect(unmatched.map((f) => f.id)).toEqual(["manual:m1"]);
  });
  it("pairs a sent email with its fact on identity, not time (lanou.abigail, 2026-10-08)", () => {
    // The thread stamps the email at its send time, lead-service at the event time: 61 s apart.
    const fact = (id: string, label: string, occurredAt: string) => ({
      ...christina.items[0],
      id,
      label,
      source: "outreach",
      occurredAt,
      detail: {},
    });
    const initial = fact("ievt:7b960983-3437-41ea-9b11-d761a95e975f", "initial_email", "2026-09-30T13:06:45.241Z");
    const followup = fact("ievt:f2bc3a15-2643-4ed0-a571-a2f65c35cdb8", "followup", "2026-10-08T13:06:09.210Z");
    const visit = fact("ievt:e6cdf03a", "website_visit", "2026-10-08T13:09:25.301Z");
    const thread = [
      { at: "2026-09-30T13:05:44.000Z", outreachFact: { subjectKey: initial.id } },
      { at: "2026-10-08T13:05:10.000Z", outreachFact: { subjectKey: followup.id } },
      { at: "2026-10-08T13:09:25.301Z", outreachFact: null },
    ];
    const { labels, unmatched } = joinConversationLabels(thread, [initial, followup, visit]);
    expect(labels.map((l) => l?.label ?? null)).toEqual(["Initial email", "Followup", "Website visit"]);
    expect(unmatched).toEqual([]);
  });
  it("never time-pairs an email that names a fact the conversation does not hold", () => {
    const initial = { ...christina.items[0], id: "ievt:a", label: "initial_email", occurredAt: "2026-09-30T13:05:44.000Z" };
    const { labels, unmatched } = joinConversationLabels(
      [{ at: "2026-09-30T13:05:44.000Z", outreachFact: { subjectKey: "ievt:other" } }],
      [initial],
    );
    expect(labels).toEqual([null]);
    expect(unmatched.map((f) => f.id)).toEqual(["ievt:a"]);
  });
  it("reads the sent email's identity off crm-service's thread item", () => {
    const item = PersonTimelineItemSchema.parse({
      at: "2026-09-30T13:05:44.000Z", source: "instantly", channel: "email", kind: "message", direction: "outbound",
      subject: "s", text: "t", from: "julia@veriskube.com", to: ["lanou.abigail@mayo.edu"], event: null,
      outreachFact: { subjectKey: "ievt:7b960983-3437-41ea-9b11-d761a95e975f", step: 1, position: "first" },
    });
    expect(item.outreachFact?.subjectKey).toBe("ievt:7b960983-3437-41ea-9b11-d761a95e975f");
  });
  it("finds the lead row only when lead-service decided the person's state", () => {
    expect(personLeadRowId({ stateSource: "lead_service", stateDetail: { leadCampaignId: "0c718f70" } })).toBe("0c718f70");
    expect(personLeadRowId({ stateSource: "stripe", stateDetail: { leadCampaignId: "x" } })).toBeNull();
    expect(personLeadRowId({ stateSource: "lead_service", stateDetail: null })).toBeNull();
  });
  it("the Unibox thread and the person page render lead-service's labels and tags", () => {
    const read = (f: string) => readFileSync(join(__dirname, "../src/components/v2", f), "utf8");
    expect(read("integrations-conversations.tsx")).toContain("joinConversationLabels(");
    expect(read("integrations-conversations.tsx")).toContain("<ConversationTags");
    expect(read("person-page.tsx")).toContain("<ConversationTimelineCard");
  });
});
