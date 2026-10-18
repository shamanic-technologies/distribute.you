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
      "<RoiTile campaign={campaign} />",
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
    const tile = page.slice(page.indexOf("function RoiTile("), page.indexOf("function CampaignOverview("));
    expect(tile).toContain("shownReturn(campaign.row.revenue?.economicsMaturity, basis)");
    // Never blank (owner 2026-10-11): Learning reads the served expected return.
    expect(tile).toContain("roiToShow(roi, campaign.row.revenue?.expectedReturn)");
    // Every ROI label carries the expected (i) (owner 2026-10-11).
    expect(tile).toContain("<StatTile label={<RoiLabel />}>");
    // Green above break-even like every other ROI (owner 2026-10-06), in the shared RoiValue.
    expect(tile).toContain("<RoiValue ");
  });

  it("the answering campaign opens on the same ROI tile (owner 2026-10-11: a ROI everywhere)", () => {
    const conv = page.slice(page.indexOf("function ConversationOverview("));
    expect(conv).toContain("<RoiTile campaign={campaign} />");
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
