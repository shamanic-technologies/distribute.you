import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Owner 2026-10-11: every ROI label carries an (i) saying it is expected, and rates are never
// left out of a pipe block when the producer serves them.
const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

describe("every customer ROI label carries the expected (i)", () => {
  it.each([
    ["components/v2/pipe-sections.tsx", "<Cell label={<RoiLabel />}>"],
    ["components/v2/today-page.tsx", "<StatTile label={<RoiLabel />}"],
    ["components/v2/copilot-chat.tsx", '{c.label === "ROI" ? <RoiLabel /> : c.label}'],
    ["components/v2/campaign-page.tsx", "<StatTile label={<RoiLabel />}>"],
    ["components/v2/offer-campaigns.tsx", "<ExpectedLabel tip={ROI_TIP}>ROI</ExpectedLabel>"],
  ])("%s", (file, marker) => {
    expect(read(file)).toContain(marker);
  });

  it("the Campaigns surfaces label ROI with the (i): campaign page (2) and the list rows", () => {
    expect(read("components/v2/funnel-campaigns.tsx").match(/<RoiLabel \/>/g)?.length).toBe(2);
    expect(read("components/v2/campaigns-overview-page.tsx")).toContain("<RoiLabel />");
  });

  it("no customer surface prints a bare ROI header", () => {
    for (const f of ["components/v2/funnel-campaigns.tsx", "components/v2/pipe-sections.tsx", "components/v2/offer-campaigns.tsx"]) {
      expect(read(f)).not.toContain('font-normal">ROI</th>');
    }
  });
});

describe("pipe blocks state the served rates", () => {
  const pipes = read("components/v2/pipe-sections.tsx");
  it("reply rate and positive reply rate come off the campaign row's served revenue group", () => {
    expect(pipes).toContain("const rates = mission?.row.revenue ?? null;");
    expect(pipes).toContain("rates?.replyRatePct != null ? pct(rates.replyRatePct) : DASH");
    expect(pipes).toContain("rates?.positiveReplyRatePct != null");
  });
  it("the reader maps the served positive reply rate", () => {
    expect(read("lib/api.ts")).toContain("positiveReplyRatePct: g.outcomes?.sending?.positiveReplyRatePct,");
  });
});
