import { describe, expect, it } from "vitest";
import { CampaignScriptRowSchema, drawRuleWords, scriptLabel, strategyStateWords } from "../src/lib/campaign-engine-scripts";

// CAMPAIGN-SCRIPTS-1113: the client campaign page names a script by its served short name, its description until named.
const row = { script: "paid_client/dy_brand_team", dynasty: "dy_brand_team", version: 2, description: "Answers the brand's own team only.", shareOfDrawsPct: 100, drawnMost: true, ruledOutReason: null, llms: [], templates: [], campaign: { runs: 150, reached: [], spentUsd: 0.01, costPerRunUsd: 0.00007, lastRunDay: "2026-11-13" } };

describe("campaign engine-scripts reader", () => {
  it("parses a row before and after features-service serves `name`", () => {
    expect(CampaignScriptRowSchema.parse(row).name).toBeUndefined();
    expect(CampaignScriptRowSchema.parse({ ...row, name: null }).name).toBeNull();
  });
  it("labels by served name, else description, else dynasty", () => {
    expect(scriptLabel({ ...row, name: "Brand team assistant" })).toBe("Brand team assistant");
    expect(scriptLabel({ ...row, name: null })).toBe("Answers the brand's own team only.");
    expect(scriptLabel({ ...row, description: null })).toBe("dy_brand_team");
  });
  it("words every served rule and state", () => {
    expect(drawRuleWords("cheapest_per_run")).toContain("cheapest");
    expect(strategyStateWords("no_condition")).toContain("every script competes");
  });
});
