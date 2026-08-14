import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  funnelSteps,
  stepsFor,
  leadTabsFor,
  chartMetricKeysFor,
  outcomeStepFor,
  outcomeTabFor,
  goalSteps,
  goalLeadTabs,
  goalChartMetricKeys,
  goalOutcomeStep,
} from "../src/lib/goal-steps";
import type { BrandOptimizationGoal } from "../src/lib/api";
import type { SalesFunnelKey, SalesFunnelKeyWire } from "../src/lib/sales-funnels";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

const ALL_GOALS: BrandOptimizationGoal[] = [
  "signups",
  "sales_meetings",
  "website_visits",
  "positive_replies",
  "form_submissions",
  "website_purchase",
  "sales",
];

const ALL_FUNNELS: SalesFunnelKey[] = [
  "reply_meeting",
  "visit_meeting",
  "visit_signup",
  "visit_form",
];

const keys = (funnelKey: SalesFunnelKeyWire) => funnelSteps(funnelKey).map((s) => s.key);

/**
 * A campaign sells ONE sales funnel and states which on its own row. The goal cannot
 * stand in for it: `reply_meeting` and `visit_meeting` both answer to `sales_meetings`,
 * so a goal-keyed surface hands the website-visit leg to a campaign whose chain starts at
 * a positive reply. That is what put "Website Visits · Cost per website visit · Sales
 * Meetings" on a Sales-Meeting-from-Conversation campaign.
 */
describe("funnelSteps — the campaign's own chain, not the goal's superset", () => {
  it("puts the reply where the website visit sits on the website funnels", () => {
    expect(keys("reply_meeting")).toEqual(["outreach", "positive_replies", "sales_meetings"]);
    expect(keys("reply_meeting")).not.toContain("website_visits");
  });

  it("keeps the visit on every chain that starts with a click onto the site", () => {
    expect(keys("visit_meeting")).toEqual(["outreach", "website_visits", "sales_meetings"]);
    expect(keys("visit_signup")).toEqual(["outreach", "website_visits", "signups"]);
    expect(keys("visit_form")).toEqual(["outreach", "website_visits", "form_submissions"]);
  });

  it("reads the canonical wire spellings the fleet is renaming to", () => {
    // Same discipline as `normalizeSalesFunnelKey`: read both, so the day brand-service
    // emits the new vocabulary the surface does not go blank.
    expect(keys("sales_meetings_from_conversation")).toEqual(keys("reply_meeting"));
    expect(keys("sales_meetings_from_website")).toEqual(keys("visit_meeting"));
    expect(keys("website_purchases")).toEqual(keys("visit_signup"));
    expect(keys("form_magnet")).toEqual(keys("visit_form"));
  });

  it("ends every chain on its own terminal outcome", () => {
    // Unlike the 1-step goals (a visit / a reply IS the outcome), a funnel always carries
    // an outcome pair — the chain is what it sells, and it sells a paid client.
    for (const key of ALL_FUNNELS) {
      const steps = funnelSteps(key);
      expect(steps[steps.length - 1]?.outcome, key).toBeTruthy();
      expect(outcomeStepFor("sales_meetings", key)?.key, key).toBe(steps[steps.length - 1]?.key);
    }
  });

  it("reuses the goal steps rather than declaring a second vocabulary", () => {
    // Identity, not shape: a funnel points at the SAME step objects the goals use, so a
    // rate, a colour or a label cannot drift into two versions of one number.
    const goalStepObjects = new Set(ALL_GOALS.flatMap((g) => goalSteps(g)));
    for (const key of ALL_FUNNELS) {
      for (const step of funnelSteps(key)) {
        expect(goalStepObjects.has(step), `${key}/${step.key}`).toBe(true);
      }
    }
  });
});

describe("stepsFor — no funnel stated falls back to the goal, byte-identical", () => {
  it("is the goal's answer for every goal when the funnel is absent or null", () => {
    for (const goal of ALL_GOALS) {
      expect(stepsFor(goal), goal).toEqual(goalSteps(goal));
      expect(stepsFor(goal, null), goal).toEqual(goalSteps(goal));
      expect(leadTabsFor(goal, null), goal).toEqual(goalLeadTabs(goal));
      expect(chartMetricKeysFor(goal, null), goal).toEqual(goalChartMetricKeys(goal));
      expect(outcomeStepFor(goal, null), goal).toEqual(goalOutcomeStep(goal));
    }
  });

  it("lets the funnel override the goal on every derived surface", () => {
    // The reply→meeting funnel under the `sales_meetings` goal: no click anywhere.
    expect(chartMetricKeysFor("sales_meetings", "reply_meeting")).toEqual([
      "outreach",
      "repliedPositive",
    ]);
    expect(chartMetricKeysFor("sales_meetings", null)).toContain("clicks");
    expect(leadTabsFor("sales_meetings", "reply_meeting")).toEqual([
      "positive-replies",
      "outreach",
    ]);
    expect(leadTabsFor("sales_meetings", "reply_meeting")).not.toContain("clicks");
    expect(outcomeTabFor("sales_meetings", "reply_meeting")?.tab).toBe("meetings");
    expect(outcomeTabFor("sales_meetings", "visit_signup")?.tab).toBe("signups");
  });
});

describe("the campaign Overview reads the funnel it states", () => {
  const page = read("components/campaigns/campaign-overview-page.tsx");

  it("takes the funnel off the campaign row and never derives it from the goal", () => {
    expect(page).toContain("const campaignFunnelKey = campaign?.funnelKey ?? null;");
    expect(page).toContain("funnelKey={campaignFunnelKey}");
    // Deriving a funnel from a goal prints a chain the campaign never stated — two
    // funnels answer to `meetingBooked`, so the goal cannot pick between them.
    expect(page).not.toContain("primaryFunnelForGoal");
  });
});

describe("the stat cards decide each pair from the steps, not from a goal test", () => {
  const cards = read("components/revenue/outreach-stat-cards.tsx");

  it("gates the Website Visits pair on the visit actually being on the chain", () => {
    expect(cards).toContain('const showVisitPair = hasStep("website_visits");');
    expect(cards).toContain("{showFunnelMetrics && showVisitPair && (");
  });

  it("shows the reply pair whenever the reply is a mid-chain signal", () => {
    expect(cards).toContain(
      'const showReplyPair = hasStep("positive_replies") && !isPositiveReplies;',
    );
    // The old rule was `goal === "sales"`, which is why the reply→meeting funnel got the
    // visit pair instead of its own first step.
    expect(cards).not.toContain('const showReplyPair = goal === "sales";');
  });

  it("keeps the terminal-reply case (the 1-step goal) distinct from a mid-chain reply", () => {
    expect(cards).toContain(
      'const isPositiveReplies = hasStep("positive_replies") && outcomeStep === null;',
    );
    expect(cards).not.toContain('const isPositiveReplies = goal === "positive_replies";');
  });

  it("reads the funnel-keyed helpers", () => {
    expect(cards).toContain('import { outcomeStepFor, stepsFor } from "@/lib/goal-steps";');
    expect(cards).toContain("const steps = stepsFor(goal, funnelKey);");
    expect(cards).toContain("const outcomeStep = outcomeStepFor(goal, funnelKey);");
  });
});

describe("the chart and the Leads tabs follow the same funnel", () => {
  it("keys the activity bars on the funnel when the surface states one", () => {
    const chart = read("components/revenue/pipeline-activity-chart.tsx");
    expect(chart).toContain("chartMetricKeysFor(optimizationGoal, funnelKey)");
    expect(chart).not.toContain("goalChartMetricKeys(");
  });

  it("keys the Outcome line's own signal on the funnel too", () => {
    const section = read("components/revenue/revenue-overview-section.tsx");
    expect(section).toContain('funnelSteps(funnelKey).some((s) => s.key === "website_visits")');
    expect(section).toContain("funnelKey={funnelKey}");
  });

  it("keys the Leads tabs on the campaign's funnel, read off the shared campaign key", () => {
    const leads = read("components/audiences/engaged-leads-page.tsx");
    expect(leads).toContain('["campaign", campaignId ?? "none"]');
    expect(leads).toContain("const funnelKey = campaignData?.campaign.funnelKey ?? null;");
    expect(leads).toContain("outcomeTabFor(goal, funnelKey)");
    expect(leads).toContain("leadTabsFor(goal, funnelKey)");
    // The auto-select latch is one-shot, so it must not fire before the funnel lands or
    // it parks the user on a tab the chain does not offer.
    expect(leads).toContain("if (campaignId && campaignData === undefined) return;");
  });
});

describe("the brand-level Pause control is gone, everywhere", () => {
  it("deletes the control, its budget sibling and the mail route that fired with it", () => {
    expect(exists("components/brand/brand-status-control.tsx")).toBe(false);
    expect(exists("components/settings/brand-daily-budget-card.tsx")).toBe(false);
    expect(exists("app/(authed)/api/brand-status-email/route.ts")).toBe(false);
  });

  it("leaves no writer for the brand pause flag", () => {
    // Pausing is defunding the funnel now: a brand-wide flag beside per-funnel ceilings
    // would be two ways to say one thing, and only one of them is what billing charges.
    expect(read("lib/api.ts")).not.toContain("export async function setBrandPause");
    const srcFiles = fs
      .readdirSync(path.join(SRC), { recursive: true, encoding: "utf-8" })
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
    for (const rel of srcFiles) {
      const body = fs.readFileSync(path.join(SRC, rel), "utf-8");
      expect(body, `${rel} still writes the brand pause flag`).not.toContain("setBrandPause(");
    }
  });

  it("keeps the READ, which the reassurance banner needs", () => {
    // A banner promising a first outcome must not run on a brand that is not running.
    expect(read("lib/api.ts")).toContain("export async function getBrandPause");
    for (const rel of [
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
      "components/campaigns/campaign-overview-page.tsx",
    ]) {
      expect(read(rel), rel).toContain("getBrandPause(brandId)");
      expect(read(rel), rel).toContain("paused: isBrandPaused");
    }
  });
});
