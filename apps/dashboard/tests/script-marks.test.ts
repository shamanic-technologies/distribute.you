import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EnginePicksSchema } from "../src/lib/engine-picks";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

/** SCRIPT-MARKS-1103 (owner 2026-11-03: « Tu utilises les icônes Workflow pour les objets scripts, c'est normal ? »). */
describe("every script the dashboard names wears its own served mark", () => {
  it("the engine picks read keeps the served icon and colour, null before a script has one", () => {
    const base = { campaignId: "c", campaignName: "Active Email Replies", outcome: "conversation", outcomeName: "Positive reply", workflowDynastySlug: "sales-cold-email-outreach-ballad", workflowName: "Sales Cold Email Outreach Ballad", channelName: null, sharePct: 89.8, state: "picked", why: "w", pickedAt: null };
    const parsed = EnginePicksSchema.parse({ offerId: "o", brandId: "b", computedAt: null, picks: [{ ...base, icon: "envelope-simple", color: "#2563eb" }, { ...base, icon: null, color: null }, base] });
    expect(parsed.picks.map((p) => p.icon ?? null)).toEqual(["envelope-simple", null, null]);
  });

  it("Today's picks, the Plan, Scripts per Engine and the people journeys pass the served mark", () => {
    expect(read("components/v2/engine-picks-section.tsx")).toContain('<CatalogueObjectMark kind="workflow" name={name} icon={p.icon} color={p.color} size={28} />');
    const factory = read("components/v2/factory-campaign.tsx");
    expect(factory.match(/name=\{c\.workflowDynastyName \?\? c\.channelName\} icon=\{c\.icon\} color=\{c\.color\}/g)?.length).toBe(2);
    expect(factory).toContain("name={sc.workflowName} icon={sc.icon} color={sc.color}");
  });
});
