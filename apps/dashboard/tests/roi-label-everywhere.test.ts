import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Owner 2026-10-11: every ROI label carries an (i) saying it is expected, and rates are never
// left out of a pipe block when the producer serves them.
const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("every customer ROI label carries the expected (i)", () => {
  it.each([
    ["components/v2/today-page.tsx", "<StatTile label={<RoiLabel />}"],
    ["components/v2/copilot-chat.tsx", '{c.label === "ROI" ? <RoiLabel /> : c.label}'],
    ["components/v2/campaign-page.tsx", "<StatTile label={<RoiLabel />}>"],
  ])("%s", (file, marker) => {
    expect(read(file)).toContain(marker);
  });

  it("the Campaigns surfaces label ROI with the (i): campaign page (1: its This campaign tile) and the list rows", () => {
    expect(read("components/v2/funnel-campaigns.tsx").match(/<RoiLabel \/>/g)?.length).toBe(1);
    expect(read("components/v2/campaigns-overview-page.tsx")).toContain("<RoiLabel>Expected ROI</RoiLabel>");
    expect(read("components/v2/campaigns-overview-page.tsx")).toContain("<RoiLabel>Realized ROI</RoiLabel>");
  });

  it("no customer surface prints a bare ROI header", () => {
    for (const f of ["components/v2/funnel-campaigns.tsx", "components/v2/factory-campaign.tsx", "components/v2/offer-campaigns.tsx"]) {
      expect(read(f)).not.toContain('font-normal">ROI</th>');
    }
  });
});

describe("the served rates", () => {
  it("the reader maps the served positive reply rate", () => {
    expect(read("lib/api.ts")).toContain("positiveReplyRatePct: g.outcomes?.sending?.positiveReplyRatePct,");
  });
});
