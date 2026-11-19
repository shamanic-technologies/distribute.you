import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CampaignChangesSchema, changePctWords, dayWords, inconclusiveWords, rateWords, verdictPill, whoWords } from "../src/lib/campaign-changes";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
const win = (rate: number | null) => ({ fromDay: rate == null ? null : "2026-11-17", toDay: rate == null ? null : "2026-11-17", decisions: rate == null ? 0 : 32, cases: rate == null ? 0 : 2, rate });
const result = (over: Record<string, unknown> = {}) => ({
  measuredEngine: { outcomeKey: "llm_completion", label: "LLM completion" },
  step: { outcomeKey: "message_written", label: "Message written" },
  maturityDays: 1,
  windowDays: 7,
  before: win(0.0625),
  after: win(0.7689),
  changePct: 1130.3,
  probabilityBetter: null,
  verdict: "confounded",
  verdictReason: "another_change_in_the_window",
  measuredOn: null,
  confoundedWith: ["budget:202"],
  ...over,
});

describe("campaign change log (features-service CAMPAIGN-CHANGE-LOG-1119)", () => {
  it("parses the served body (Wide Email shape), a reason the page does not know included", () => {
    const body = CampaignChangesSchema.parse({
      brandId: "b",
      salesFunnelCampaignId: "c",
      name: "Wide Email",
      computedAt: "2026-11-19T09:25:21.236Z",
      decisionsBuiltAt: null,
      silverComputedAt: null,
      settingsRecordedSince: "2026-11-19",
      rules: {},
      kindsServed: ["script_started"],
      total: 2,
      nextCursor: null,
      changes: [
        {
          id: "x",
          at: "2026-11-18T00:00:00.000Z",
          date: "2026-11-18",
          kind: "script_started",
          engine: { outcomeKey: "llm_completion", label: "LLM completion" },
          from: null,
          to: { scriptDynasty: "llm_completion/dy_deepseek_flash", version: "v2", value: null, label: "DeepSeek Flash" },
          summary: "LLM completion: started using DeepSeek Flash",
          who: "our_ai",
          whoEvidence: "the_rating_picks_the_script",
          reason: null,
          shareOfEngineDay: 0.561,
          tried: null,
          parts: null,
          result: result(),
        },
        { id: "y", at: "2026-11-17T21:03:07Z", date: "2026-11-17", kind: "budget_changed", engine: null, from: null, to: null, summary: "Max budget", who: null, whoEvidence: null, reason: null, shareOfEngineDay: null, tried: null, parts: null, result: result({ verdictReason: "a_new_reason", verdict: "inconclusive" }) },
      ],
    });
    expect(body.changes).toHaveLength(2);
  });

  it("words who, the day, the served rates and the verdict; never a raw code", () => {
    expect(whoWords("our_ai")).toBe("Our AI");
    expect(whoWords("a_person")).toBe("You or our team");
    expect(whoWords("our_system")).toBe("Our system");
    expect(whoWords(null)).toBeNull();
    expect(dayWords("2026-12-05", "2026-11-19T09:00:00Z")).toBe("Dec 5");
    expect(dayWords("2027-02-05", "2026-11-19T09:00:00Z")).toBe("Feb 5, 2027");
    expect(rateWords(0.0625)).toBe("6%");
    expect(rateWords(0.004)).toBe("0.4%");
    expect(rateWords(null)).toBeNull();
    expect(changePctWords(1130.3)).toBe("+1130%");
    expect(changePctWords(-30.4)).toBe("-30%");
    expect(changePctWords(null)).toBeNull();
    const r = (over: Record<string, unknown>) => CampaignChangesSchema.shape.changes.element.shape.result.parse(result(over));
    expect(verdictPill(r({ verdict: "worked" }))).toEqual({ label: "Worked", tone: "good" });
    expect(verdictPill(r({ verdict: "did_not_work" }))).toEqual({ label: "Didn't work", tone: "bad" });
    expect(verdictPill(r({ verdict: "too_early", measuredOn: "2026-12-05" }), "2026-11-19T00:00:00Z").label).toBe("Measured on Dec 5");
    expect(verdictPill(r({ verdict: "confounded" })).label).toBe("Overlaps another change");
    expect(inconclusiveWords("nothing_before_to_compare")).toBe("Nothing ran before it to compare with.");
    expect(inconclusiveWords("a_new_reason")).toBe("Not enough data to tell yet.");
  });

  it("reads the gateway path, sits right under Forecast, and computes nothing in the browser", () => {
    expect(src("lib/api.ts")).toContain("/sales-funnel-campaigns/${encodeURIComponent(salesFunnelCampaignId)}/changes?");
    const factory = src("components/v2/factory-campaign.tsx");
    const at = factory.indexOf("<CampaignForecast brandId");
    expect(at).toBeGreaterThan(0);
    expect(factory.indexOf("<CampaignChanges brandId")).toBeGreaterThan(at);
    expect(factory.indexOf("<CampaignChanges brandId")).toBeLessThan(factory.indexOf("{staffMode &&"));
    const code = src("components/v2/campaign-changes.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.reduce\(|\.sort\(|\.rate\s*[-*/+]|changePct\s*[-*/+]|cases\s*\/|decisions\s*\//);
    expect(code).toContain("getFunnelCampaignChanges(brandId, campaignId)");
    expect(src("lib/persist-cache.ts")).toContain('"campaignChanges"');
  });
});
