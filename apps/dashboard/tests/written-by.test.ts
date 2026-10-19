import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WrittenBySchema, hasWrittenBy, vendorDomain, writtenByForMessage, type WrittenByEntry } from "../src/lib/written-by";

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

  it("an entry with no model, no tactic line and not under test has nothing to show", () => {
    expect(hasWrittenBy(entry({ model: null, tactics: [], underTest: false }))).toBe(false);
    expect(hasWrittenBy(entry({ model: null, tactics: [], underTest: null }))).toBe(false);
    expect(hasWrittenBy(entry({ model: null, tactics: [], underTest: true }))).toBe(true);
    expect(hasWrittenBy(entry({}))).toBe(true);
    expect(hasWrittenBy(null)).toBe(false);
  });

  it("a known vendor draws its logo, an unknown one none", () => {
    expect(vendorDomain("anthropic")).toBe("anthropic.com");
    expect(vendorDomain("openai")).toBe("openai.com");
    expect(vendorDomain("google")).toBe("google.com");
    expect(vendorDomain("someone-new")).toBeNull();
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

describe("where the line is drawn", () => {
  it("under every email we sent on the person page, and in the Unibox thread", () => {
    const timeline = read("components/audiences/lead-history-timeline.tsx");
    expect(timeline).toContain('e.type === "message" && e.direction === "outbound"');
    expect(timeline).toContain("<WrittenByLine entries={writtenBy} campaignId={e.campaignId} at={e.at} />");
    expect(read("components/v2/person-page.tsx")).toContain("writtenBy={writtenBy}");
    const unibox = read("components/v2/integrations-conversations.tsx");
    expect(unibox).toContain("useLeadWrittenBy(facts?.leadId ?? null)");
    expect(unibox).toContain("campaignId={sentCampaignId(row.item, facts)}");
  });

  it("never names a workflow or a cost", () => {
    const line = read("components/v2/written-by-line.tsx");
    expect(line).not.toMatch(/workflowSlug|workflowName|cost/i);
  });
});
