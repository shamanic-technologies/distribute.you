import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EnginePicksSchema, pickStateWords } from "../src/lib/engine-picks";

// FACTORY-USER-DASHBOARD-1102: Today's "Why each one was picked" (the GTM Factory Today page), every client.
const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("the offer's Engine picks (features-service, via api-service)", () => {
  it("parses the served body, a pick with no share and no pick date included", () => {
    const body = EnginePicksSchema.parse({
      offerId: "o",
      brandId: "b",
      computedAt: "2026-11-02T08:14:41.212Z",
      picks: [
        { campaignId: "c", campaignName: "Signup Follow-up", outcome: "paid_client", outcomeName: "Paid client", workflowDynastySlug: "ai-follow-up-email-tureis", workflowName: "Ai Follow Up Email Tureis", channelName: "AI Follow-up Email", sharePct: 100, state: "running", why: "Ai Follow Up Email Tureis took 100% of the Engine's draws: the best expected value per dollar for Paid client.", pickedAt: "2026-11-02T08:14:41.212Z", runningSince: null, retryAt: null },
        { campaignId: "d", campaignName: "x", outcome: "lead_found", outcomeName: "Lead", workflowDynastySlug: "s", workflowName: null, channelName: null, sharePct: null, state: "rolled_back", why: "w", pickedAt: null },
      ],
    });
    expect(body.picks).toHaveLength(2);
    expect(pickStateWords(body.picks[1].state)).toBe("Rolled back");
    expect(pickStateWords("running")).toBeNull();
  });

  it("Today draws the section for the selected offer, reading the served sentence, never composing one", () => {
    expect(read("components/v2/today-page.tsx")).toContain("<EnginePicksSection orgId={orgId} brandId={brandId} offerId={selectedOfferId} />");
    const s = read("components/v2/engine-picks-section.tsx");
    expect(s).toContain('["offerEnginePicks", brandId, offerId]');
    expect(s).toContain("{p.campaignName}: {p.why}");
    expect(s).not.toMatch(/useStaffMode|StaffOnly/);
    expect(read("lib/api.ts")).toContain("/offers/${encodeURIComponent(offerId)}/engine-picks?brandId=${encodeURIComponent(brandId)}");
  });
});
