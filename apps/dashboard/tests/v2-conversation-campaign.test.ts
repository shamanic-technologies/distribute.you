import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "../src/components/v2/campaign-page.tsx"), "utf8");

describe("v2 campaign page: a campaign that answers conversations (AI Meeting Booking)", () => {
  it("reads its leg as a path with the channel on the arrow: from → [channel] → to", () => {
    const from = src.indexOf("{mission.leg.fromLabel}</span>");
    const chip = src.indexOf("{def.name}");
    const to = src.indexOf("{mission.leg.toLabel}</span>");
    expect(from).toBeGreaterThan(-1);
    expect(from).toBeLessThan(chip);
    expect(chip).toBeLessThan(to);
  });

  it("opens the conversation overview for a leg that starts on a step", () => {
    expect(src).toContain('tab === "overview" && mission.leg?.fromKey ? (');
    expect(src).toContain("<ConversationOverview");
  });

  it("states replies, ongoing, booked and dropped, never the cold-email steps", () => {
    const body = src.slice(src.indexOf("function ConversationOverview("));
    expect(body).toContain('label="Ongoing conversations"');
    expect(body).toContain('label="Dropped conversations"');
    expect(body).not.toContain("Queued");
    expect(body).not.toContain("Delivered");
    // Dropped is a card, not a step.
    expect(body).not.toMatch(/StepBar label="Dropped/);
  });

  it("reads the four counts from lead-service on the acting campaign", () => {
    const body = src.slice(src.indexOf("function ConversationOverview("));
    expect(body).toContain("getConversationCounts(mission.row.campaign.id)");
    expect(body).toContain("conv?.meetingsBooked");
  });
});
