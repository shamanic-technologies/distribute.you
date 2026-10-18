import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { conversationItemSide } from "../src/lib/conversation-timeline";

const v2 = (f: string) => readFileSync(join(__dirname, "../src/components/v2", f), "utf8");
const RECORDS = ["companies-page.tsx", "company-page.tsx", "people-page.tsx", "deals-page.tsx"];

/**
 * Records (Companies, People, Deals, a company) name the CAMPAIGN that reached a person, by its
 * served name and face (owner 2026-10-18: crews and missions are retired vocabulary there).
 */
describe("v2 Records read campaigns, never crews", () => {
  it.each(RECORDS)("%s says nothing of crews or missions", (f) => {
    const src = v2(f);
    expect(src).not.toMatch(/crew/i);
    expect(src).not.toMatch(/useCampaigns|campaignById/);
  });

  it.each(["company-page.tsx", "people-page.tsx", "deals-page.tsx"])("%s names a person's campaign by face + name", (f) => {
    const src = v2(f);
    expect(src).toContain("useLeadCampaigns(orgId, brandId)");
    expect(src).toContain("<FunnelFace name={campaign.name}");
  });

  it("People's column is Campaign", () => {
    expect(v2("people-page.tsx")).toContain("<th className={REC_TH}>Campaign</th>");
  });

  it("Deals filters by the offer's campaigns", () => {
    const src = v2("deals-page.tsx");
    expect(src).toContain("campaignOf(l.campaignId)?.key === campaignFilter");
  });

  it("a funnel part is named by its funnel campaign, a pre-funnel campaign by its own served name", () => {
    const src = v2("lead-campaigns.ts");
    expect(src).toContain("funnelById.get(c.salesFunnelCampaignId)");
    expect(src).toContain("campaignNameFor(legCatalogue, c.featureSlug, c.legKey)");
  });

  it("a company's timeline is its people's lead-service conversations, keyed like the person page", () => {
    const src = v2("company-page.tsx");
    expect(src).toContain('queryKey: ["leadTimeline", l.id, brandId, offerId]');
    expect(src).toContain("liveItems(t)");
    expect(src).not.toContain("firstDeliveredAt");
  });
});

describe("conversationItemSide", () => {
  it("our emails are Us", () => {
    expect(conversationItemSide("initial_email")).toBe("us");
    expect(conversationItemSide("followup")).toBe("us");
    expect(conversationItemSide("bounced")).toBe("us");
  });
  it("what the person did is Them", () => {
    expect(conversationItemSide("reply")).toBe("them");
    expect(conversationItemSide("website_visit")).toBe("them");
    expect(conversationItemSide("meeting_booked")).toBe("them");
  });
});
