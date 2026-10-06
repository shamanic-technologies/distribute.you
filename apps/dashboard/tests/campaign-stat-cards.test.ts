import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Owner 2026-10-06: the campaign page's stat cards read ROI (i), Contacted, Queued, Sent,
// Delivered, the leg's outcome, Spent, cost per outcome; one person is "person", never "1 people".
const page = readFileSync(join(__dirname, "..", "src/components/v2/campaign-page.tsx"), "utf8");
const overview = page.slice(page.indexOf("function CampaignOverview("), page.indexOf("function ConversationOverview("));

describe("campaign page stat cards", () => {
  it("states the cards in the owner's order", () => {
    const order = [
      'label="ROI"',
      'label="Contacted"',
      'label="Queued"',
      'label="Sent"',
      'label="Delivered"',
      "leg.outcome",
      "<SpentTile ",
      '"Cost / reply"',
    ].map((t) => overview.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("reads the served return with its (i), never a recomputation", () => {
    expect(overview).toContain("shownReturn(g?.economicsMaturity, basis)");
    expect(overview).toContain("note={<InfoTooltip tip={CAMPAIGN_ROI_TIP}");
    // Green above break-even like every other ROI (owner 2026-10-06).
    expect(overview).toContain('roiIsGood(roi.value) ? "text-[var(--run)]" : ""');
  });

  it("Queued, Sent and Delivered count emails off the campaign window", () => {
    expect(overview).toContain('<StatTile label="Queued">{emailCount(queued)}</StatTile>');
    expect(overview).toContain('<StatTile label="Sent">{emailCount(emails?.sent)}</StatTile>');
    expect(overview).toContain('<StatTile label="Delivered">{emailCount(emails?.delivered)}</StatTile>');
    expect(overview).toContain('unit={v === 1 ? "email" : "emails"}');
  });

  it("states the 8 cards on one row on desktop", () => {
    expect(overview).toContain('grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8');
  });

  it("one person is a person", () => {
    expect(overview).toContain('unit={v === 1 ? "person" : "people"}');
  });
});
