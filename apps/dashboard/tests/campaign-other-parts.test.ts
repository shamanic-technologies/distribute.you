import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FunnelCampaignCopiesSchema, FunnelCampaignRowsSchema } from "../src/lib/sales-funnel-campaigns";

/**
 * CAMPAIGN-PATH-SHOWS-AI-ANSWER-1109 (owner 2026-11-09): Living Vital "Email Replies" read
 * "Start → Lead found → Positive reply → Paid client" while a part on every Lead event had our AI
 * answer the lead. features-service serves `otherParts[]`; each is drawn as its own line under the path.
 */
const src = (f: string) => readFileSync(join(__dirname, "..", "src", f), "utf8");

const livingVitalCopy = {
  id: "c1",
  salesFunnelId: "sf1",
  runningSalesFunnelId: "sf1",
  name: "Email Replies",
  status: "ongoing",
  type: "proactive",
  typeLabel: "Daily",
  path: {
    items: [
      { kind: "step", key: "start", label: "Start" },
      { kind: "step", key: "lead_found", label: "Lead found" },
      { kind: "step", key: "positive_reply", label: "Positive reply" },
      { kind: "step", key: "paid_client", label: "Paid client" },
    ],
  },
  otherParts: [
    {
      campaignId: "u9",
      pipeId: "p9",
      trigger: { slug: "lead_event", name: "Lead event" },
      items: [
        { kind: "trigger", slug: "lead_event", name: "Lead event" },
        { kind: "channel", slug: "ai-follow-up-email", name: "AI Follow-up Email", runByUs: true, pipeId: "p9" },
        { kind: "step", key: "paid_client", label: "Paid client" },
      ],
      shortDescription: "Our AI emails leads the moment they act until they buy.",
      unavailableReason: null,
    },
  ],
  copyUnavailableReason: null,
  shortDescription: "We email new buyers until they reply with interest. Our AI emails leads the moment they act until they buy.",
  shortDescriptionUnavailableReason: null,
};

describe("campaign other parts (1109)", () => {
  it("the copy reader keeps the served otherParts with their items", () => {
    const parsed = FunnelCampaignCopiesSchema.parse({ salesFunnelCampaigns: [livingVitalCopy] });
    const part = parsed.salesFunnelCampaigns[0].otherParts?.[0];
    expect(part?.items?.map((i) => i.kind)).toEqual(["trigger", "channel", "step"]);
    expect(part?.trigger?.name).toBe("Lead event");
  });

  it("an undescribed part (items null + reason) parses, and a row without otherParts still parses", () => {
    const undescribed = { ...livingVitalCopy, otherParts: [{ campaignId: "u2", pipeId: "p2", trigger: null, items: null, shortDescription: null, unavailableReason: "pipe_not_in_catalogue" }] };
    expect(FunnelCampaignCopiesSchema.parse({ salesFunnelCampaigns: [undescribed] }).salesFunnelCampaigns[0].otherParts?.[0].items).toBeNull();
    const legacy: Record<string, unknown> = { ...livingVitalCopy };
    delete legacy.otherParts;
    expect(FunnelCampaignCopiesSchema.parse({ salesFunnelCampaigns: [legacy] }).salesFunnelCampaigns[0].otherParts).toBeUndefined();
  });

  it("the full row reader keeps otherParts too", () => {
    const row = { ...livingVitalCopy, investedUsd: 0, costEconomics: null };
    expect(FunnelCampaignRowsSchema.parse({ salesFunnelCampaigns: [row] }).salesFunnelCampaigns[0].otherParts).toHaveLength(1);
  });

  it("each part is drawn with the path line's own component, and nothing when there is none", () => {
    const f = src("components/v2/funnel-campaigns.tsx");
    const body = f.slice(f.indexOf("export function FunnelOtherPartLines("), f.indexOf("export function TypeTag("));
    expect(body).toContain("<FunnelPathLine items={part.items} />");
    expect(body).toContain("if (!parts || parts.length === 0) return null;");
  });

  it("the Campaigns row and the campaign page header draw the parts (call sites)", () => {
    expect(src("components/v2/campaigns-overview-page.tsx")).toContain("after={<FunnelOtherPartLines campaignId={campaign.id} parts={copy?.otherParts} />}");
    expect(src("components/v2/campaign-page-next.tsx")).toContain("<FunnelOtherPartLines campaignId={campaign.id} parts={otherParts} />");
  });

  it("each part line carries its served sentence, so it says that our AI does it", () => {
    const f = src("components/v2/funnel-campaigns.tsx");
    const body = f.slice(f.indexOf("export function FunnelOtherPartLines("), f.indexOf("export function TypeTag("));
    expect(body).toContain("{part.shortDescription}");
  });

  it("the campaign page every customer opens (Goal card) states the served description, every part included", () => {
    const aim = src("components/v2/campaign-aim.tsx");
    expect(aim).toContain(">What we do</p>");
    expect(aim).toContain("copy?.shortDescription");
  });
});
