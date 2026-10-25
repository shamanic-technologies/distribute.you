import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WrittenBySchema,
  modelLogoFiles,
  modelTag,
  tagsThatFit,
  writtenByForMessage,
  writtenByForRow,
  writtenMessageId,
  writtenWithTags,
  type WrittenByEntry,
  type WrittenByMessage,
} from "../src/lib/written-by";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

const entry = (over: Partial<WrittenByEntry>): WrittenByEntry => ({
  campaignId: "c1",
  writtenAt: "2026-10-18T10:00:00.000Z",
  model: { name: "Claude Opus 5.5", vendor: { id: "anthropic", name: "Anthropic" } },
  modelUnavailableReason: null,
  tactics: [{ line: "Names your company in the first email." }],
  tacticsUnavailableReason: null,
  underTest: true,
  underTestUnavailableReason: null,
  ...over,
});

describe("writtenByForMessage (WRITTEN-BY-1019)", () => {
  const older = entry({ writtenAt: "2026-10-10T10:00:00.000Z", model: { name: "Gemini 3 Flash", vendor: { id: "google", name: "Google" } } });
  const newer = entry({ writtenAt: "2026-10-18T10:00:00.000Z" });
  const other = entry({ campaignId: "c2", writtenAt: "2026-10-18T11:00:00.000Z" });
  const entries = [other, newer, older];

  it("picks the latest entry of the message's campaign written at or before it", () => {
    expect(writtenByForMessage(entries, { campaignId: "c1", at: "2026-10-19T08:00:00.000Z" })).toBe(newer);
    expect(writtenByForMessage(entries, { campaignId: "c1", at: "2026-10-12T08:00:00.000Z" })).toBe(older);
    expect(writtenByForMessage(entries, { campaignId: "c1", at: "2026-10-18T10:00:00.000Z" })).toBe(newer);
  });

  it("shows nothing when no entry fits: never another campaign's, never a later one", () => {
    expect(writtenByForMessage(entries, { campaignId: "c1", at: "2026-10-01T00:00:00.000Z" })).toBeNull();
    expect(writtenByForMessage(entries, { campaignId: "c3", at: "2026-10-19T00:00:00.000Z" })).toBeNull();
    expect(writtenByForMessage(entries, { campaignId: null, at: "2026-10-19T00:00:00.000Z" })).toBeNull();
    expect(writtenByForMessage(entries, { campaignId: "c1", at: null })).toBeNull();
    expect(writtenByForMessage([], { campaignId: "c1", at: "2026-10-19T00:00:00.000Z" })).toBeNull();
  });

  it("tags: the model, then each NAMED tactic, its client line on hover; nothing else", () => {
    const tags = writtenWithTags(
      entry({ tactics: [{ line: "Brand not named in the first email", name: "Blind angle" }, { line: "No name yet" }] }),
    );
    expect(tags?.model).toEqual({ label: "Opus 5.5", name: "Claude Opus 5.5", logoSrc: "/model-logos/claude.svg" });
    expect(tags?.tactics).toEqual([{ name: "Blind angle", line: "Brand not named in the first email" }]);
    // Under test is not a tag (owner 2026-10-19).
    expect(writtenWithTags(entry({ model: null, tactics: [], underTest: true }))).toBeNull();
    expect(writtenWithTags(entry({ model: null, tactics: [{ line: "unnamed" }] }))).toBeNull();
    expect(writtenWithTags(null)).toBeNull();
  });

  it("a model reads as its PRODUCT (Claude's mark, Gemini's sparkle), its family word dropped", () => {
    expect(modelTag({ name: "Claude Opus 5.5", vendor: { id: "anthropic" } })).toEqual({ label: "Opus 5.5", name: "Claude Opus 5.5", logoSrc: "/model-logos/claude.svg" });
    expect(modelTag({ name: "Gemini 3 Flash", vendor: { id: "google" } })).toMatchObject({ label: "3 Flash", logoSrc: "/model-logos/gemini.svg" });
    expect(modelTag({ name: "GPT-5.5", vendor: { id: "openai" } })).toMatchObject({ label: "GPT-5.5", logoSrc: "/model-logos/openai.svg" });
    expect(modelTag({ name: "Newco 1", vendor: { id: "someone-new" } })).toEqual({ label: "Newco 1", name: "Newco 1", logoSrc: null });
  });

  it("every product mark the lookup names ships as a file", () => {
    for (const f of modelLogoFiles()) expect(existsSync(join(__dirname, "../public/model-logos", f)), f).toBe(true);
  });

  it("tags that do not fit: the first ones and +N more, never fewer than one", () => {
    // label 80, chips 70 each, "+N more" 60, gap 4.
    const chips = [70, 70, 70, 70];
    expect(tagsThatFit(1000, 80, chips, 60, 4)).toBe(4);
    expect(tagsThatFit(80 + 4 * 74, 80, chips, 60, 4)).toBe(4);
    // Room for two chips and the more chip: 80 + 74*2 + 4 + 60 = 292.
    expect(tagsThatFit(292, 80, chips, 60, 4)).toBe(2);
    expect(tagsThatFit(291, 80, chips, 60, 4)).toBe(1);
    expect(tagsThatFit(10, 80, chips, 60, 4)).toBe(1);
    expect(tagsThatFit(10, 80, [70], 60, 4)).toBe(1);
  });

  it("parses the producer's body, reasons as plain strings, extra fields kept", () => {
    const body = {
      leadId: "l1",
      campaignId: null,
      entries: [
        {
          ...entry({ model: null, modelUnavailableReason: "model_not_served", underTest: null, underTestUnavailableReason: "a_new_reason" }),
          somethingNew: 1,
        },
      ],
    };
    const parsed = WrittenBySchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(WrittenBySchema.safeParse({ leadId: "l1", campaignId: null }).success).toBe(false);
  });
});

describe("a real body served in prod (2026-10-19, our own org)", () => {
  it("the email sent 4 minutes after its sequence was written shows its model, mark and tactic", () => {
    const body = {
      leadId: "1c83d97b-43dc-458d-94f7-8620efa76419",
      campaignId: null,
      entries: [
        {
          campaignId: "fb201499-4f90-40da-9cc3-f612392664f2",
          writtenAt: "2026-10-12T20:11:06.457Z",
          model: { name: "Claude Sonnet 5.5", vendor: { id: "anthropic", name: "Anthropic" } },
          modelUnavailableReason: null,
          tactics: [{ line: "Brand named in the email" }],
          tacticsUnavailableReason: null,
          underTest: true,
          underTestUnavailableReason: null,
        },
      ],
    };
    const parsed = WrittenBySchema.parse(body);
    const sent = { campaignId: "fb201499-4f90-40da-9cc3-f612392664f2", at: "2026-10-12T20:15:37.070Z" };
    const e = writtenByForMessage(parsed.entries, sent);
    expect(e?.model?.name).toBe("Claude Sonnet 5.5");
    expect(e?.underTest).toBe(true);
    expect(e?.tactics.map((t) => t.line)).toEqual(["Brand named in the email"]);
    // A later AI follow-up from another campaign of the same person has no entry: nothing shown.
    expect(writtenByForMessage(parsed.entries, { campaignId: "5e9709f7-030f-4e4b-b20a-3d0e0d55c931", at: "2026-10-19T06:11:15.013Z" })).toBeNull();
  });
});

describe("where the tags sit", () => {
  it("beside the label of every message of ours: person page Timeline, Unibox thread, Unibox facts", () => {
    // The history card carries no block any more (owner 2026-10-19: tags, not sections).
    expect(read("components/audiences/lead-history-timeline.tsx")).not.toContain("WrittenWith");
    const person = read("components/v2/person-page.tsx");
    expect(person.match(/writtenBy=\{writtenBy\}/g)?.length).toBe(1);
    const card = read("components/v2/conversation-timeline.tsx");
    expect(card).toContain("<TimelineRows timeline={timeline} writtenBy={writtenBy} />");
    expect(card.indexOf("<WrittenWithTags")).toBeGreaterThan(card.indexOf("<TagChip tag={conversationItemTag(it.label)} />"));
    expect(card).toContain("messageId={it.id}");
    const unibox = read("components/v2/integrations-conversations.tsx");
    expect(unibox).toContain("useLeadWrittenBy(facts?.leadId ?? null)");
    expect(unibox).toContain("campaignId={sentCampaignId(row.item, facts)}");
    expect(unibox).toContain('item.direction === "outbound" ? (');
    expect(unibox).toContain("messageId={writtenMessageId(item)}");
    expect(unibox).toContain("<FactRow key={row.fact.id} fact={row.fact} writtenBy={writtenBy} />");
    expect(unibox).toContain("messageId={fact.id} campaignId={null}");
    // In the message header, right beside its label chip.
    expect(unibox).toContain("<TagChip tag={tag} />\n          {written}");
  });

  it("says Written with, never a workflow, a cost or an under-test mark", () => {
    const tags = read("components/v2/written-with-tags.tsx");
    expect(tags).toContain("Written with");
    // Overflow: "+N more", opened by hover (mouse) or a tap, portalled out of the card.
    expect(tags).toContain("+{count} more");
    expect(tags).toContain('e.pointerType === "mouse" && open()');
    expect(tags).toContain('document.getElementById("v2-portal")');
    expect(tags).not.toMatch(/workflowSlug|workflowName|cost|Under test|Written by/i);
  });
});

const message = (over: Partial<WrittenByMessage>): WrittenByMessage => ({
  id: "m1",
  kind: "email_sent",
  channel: "email",
  campaignId: "c1",
  sentAt: "2026-10-18T10:00:00.000Z",
  writtenBy: "workflow",
  model: { name: "Claude Opus 5.5", vendor: { id: "anthropic", name: "Anthropic" } },
  modelUnavailableReason: null,
  tactics: [],
  tacticsUnavailableReason: null,
  underTest: null,
  underTestUnavailableReason: null,
  ...over,
});

describe("writtenByForRow: every message on its own id (WRITTEN-BY-EVERY-MESSAGE-1019)", () => {
  // Shape served by features-service in prod on our own org (2026-10-19), trimmed.
  const body = {
    leadId: "a0f2fb6c-ff20-4d1d-a968-9a036bc9ca40",
    campaignId: null,
    entries: [],
    messages: [
      message({ id: "ievt:2c6e3448-d151-4982-904a-9f32853a87e0", underTest: true, sentAt: "2026-10-15T13:01:11.205Z" }),
      message({
        id: "ievt:followup-1",
        sentAt: "2026-10-18T13:01:11.205Z",
        model: { name: "Gemini 3 Flash", vendor: { id: "google", name: "Google" } },
        tactics: [{ line: "Short follow-up" }],
      }),
      message({
        id: "7a4d71b7-5200-4ea1-a733-77529a171596",
        kind: "message_out",
        channel: "whatsapp",
        campaignId: null,
        sentAt: "2026-10-15T18:01:55.999Z",
        tactics: [{ line: "Answers in the prospect's language" }],
      }),
      message({ id: "person-sent", kind: "message_out", channel: "whatsapp", campaignId: null, writtenBy: "person", model: null, modelUnavailableReason: "written_by_a_person" }),
      message({ id: "bebd8c19-c264-4343-bf19-dcce4f207020", kind: "message_out", channel: "whatsapp", campaignId: null, writtenBy: "unknown", model: null, modelUnavailableReason: "writer_unknown" }),
    ],
    messagesUnavailableReason: null,
  };
  const wb = WrittenBySchema.parse(body);

  it("a first email, a follow-up and a WhatsApp message each read their own row", () => {
    expect(writtenByForRow(wb, { id: "ievt:2c6e3448-d151-4982-904a-9f32853a87e0", campaignId: "c1", at: null })?.model?.name).toBe("Claude Opus 5.5");
    expect(writtenByForRow(wb, { id: "ievt:followup-1", campaignId: "c1", at: null })?.model?.name).toBe("Gemini 3 Flash");
    const wa = writtenByForRow(wb, { id: "7a4d71b7-5200-4ea1-a733-77529a171596", campaignId: null, at: null });
    expect(wa?.tactics.map((t) => t.line)).toEqual(["Answers in the prospect's language"]);
  });

  it("a person-sent or unknown message shows nothing, even when a campaign entry would fit", () => {
    const withEntry = { ...wb, entries: [entry({ campaignId: "c1", writtenAt: "2026-01-01T00:00:00.000Z" })] };
    expect(writtenByForRow(withEntry, { id: "person-sent", campaignId: "c1", at: "2026-10-19T00:00:00.000Z" })).toBeNull();
    expect(writtenByForRow(withEntry, { id: "bebd8c19-c264-4343-bf19-dcce4f207020", campaignId: "c1", at: "2026-10-19T00:00:00.000Z" })).toBeNull();
  });

  it("only a message with no row reads its campaign entry", () => {
    const e = entry({ campaignId: "c9", writtenAt: "2026-10-01T00:00:00.000Z" });
    const withEntry = { ...wb, entries: [e] };
    expect(writtenByForRow(withEntry, { id: "message:outreach:c9:0", campaignId: "c9", at: "2026-10-02T00:00:00.000Z" })).toBe(e);
    expect(writtenByForRow(withEntry, { id: null, campaignId: null, at: "2026-10-02T00:00:00.000Z" })).toBeNull();
    // messages unreadable: the entry match still answers.
    const unreadable = WrittenBySchema.parse({ ...body, entries: [e], messages: null, messagesUnavailableReason: "sent_messages_unreadable" });
    expect(writtenByForRow(unreadable, { id: "ievt:followup-1", campaignId: "c9", at: "2026-10-02T00:00:00.000Z" })).toEqual(e);
  });

  it("a body written before messages existed still parses", () => {
    expect(WrittenBySchema.parse({ leadId: "l", campaignId: null, entries: [] }).messages).toBeUndefined();
  });

  it("a Unibox item's id: the outreach subject key, else crm-service's fact id", () => {
    expect(writtenMessageId({ outreachFact: { subjectKey: "ievt:x" }, ref: { factId: "f" } })).toBe("ievt:x");
    expect(writtenMessageId({ outreachFact: null, ref: { eventId: "$e", factId: "f" } })).toBe("f");
    expect(writtenMessageId({ outreachFact: null, ref: { eventId: "$e" } })).toBeNull();
  });
});
