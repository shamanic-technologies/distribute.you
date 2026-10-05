import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatRatePct,
  parseOfferSalesPaths,
  pathLinks,
  pathTitle,
  pathStepReach,
  costSourceLabel,
  rateSourceLabel,
  roiUnavailableLabel,
  salesPathsEmptyReason,
} from "../src/lib/offer-sales-paths";
import { globalBudgetUsd, parseBudgetInput, parseBrandSalesBudget } from "../src/lib/brand-sales-budget";

const step = (key: string, label: string) => ({ key, label });
const body = {
  offerId: "o1",
  brandId: "b1",
  status: "ok",
  statedAt: "2026-09-29T00:00:00Z",
  selectedLegKeys: ["start_to_conversation", "conversation_to_meeting_booked"],
  unknownLegKeys: [],
  lifetimeRevenueUsd: 3000,
  pricing: "net",
  paths: [
    {
      rank: 1,
      pathKey: "p1",
      combinationKey: "start_to_conversation@sales-cold-email-outreach",
      name: "Victory",
      legKeys: ["start_to_conversation"],
      steps: [step("conversation", "Positive reply"), step("paid_client", "Paid client")],
      entryLegKey: "start_to_conversation",
      entryChannelSlug: "sales-cold-email-outreach",
      legs: [
        {
          legKey: "start_to_conversation",
          fromStep: null,
          toStep: step("conversation", "Positive reply"),
          conversionRatePct: null,
          rateSource: null,
          rateInputs: null,
          workedBy: "platform",
          channel: { slug: "sales-cold-email-outreach", name: "Herald", trigger: "daily_budget", workflowDynastySlug: null, grain: "brand", choice: "only_priced_channel", candidates: [] },
          outcomesNeededPerPayingClient: 10,
          costPerOutcomeUsd: 50,
          costPerPayingClientUsd: 500,
        },
      ],
      entryToPayingClientPct: 10,
      lifetimeRevenueUsd: 3000,
      costPerPayingClientUsd: 500,
      roi: 6,
      roiUnavailableReason: null,
      somethingNew: true,
    },
  ],
};

describe("offer sales paths, catalogue scope", () => {
  const leg = body.paths[0].legs[0];
  const catalogue = {
    ...body,
    scope: "catalogue",
    paths: [
      {
        ...body.paths[0],
        combinationKey: "start_to_website_visit@google-ads",
        ticked: false,
        legs: [
          {
            ...leg,
            ticked: false,
            costSource: "benchmark",
            channel: { ...leg.channel, slug: "google-ads", name: "Google Ads", managed: false, operatedBy: "platform", costBenchmarkSource: "WordStream 2024 B2B CPC", costSource: "benchmark" },
          },
        ],
      },
    ],
  };
  it("keeps ticked, managed, the cost rung and its cited source", () => {
    const p = parseOfferSalesPaths(catalogue, "t");
    expect(p.scope).toBe("catalogue");
    expect(p.paths[0].ticked).toBe(false);
    expect(p.paths[0].legs[0].ticked).toBe(false);
    expect(p.paths[0].legs[0].costSource).toBe("benchmark");
    expect(p.paths[0].legs[0].channel?.managed).toBe(false);
    expect(p.paths[0].legs[0].channel?.costBenchmarkSource).toBe("WordStream 2024 B2B CPC");
    expect(pathLinks(p.paths[0])[0]).toEqual({ kind: "channel", name: "Google Ads", slug: "google-ads", managed: false });
  });
  it("names every cost rung, and a leg with no cost has none", () => {
    expect(costSourceLabel("benchmark")).toBe("Market benchmark");
    expect(costSourceLabel("fleet_measured")).toBe("Measured across our clients");
    expect(costSourceLabel(null)).toBeNull();
    expect(costSourceLabel("next_rung")).toBe("next_rung");
  });
  it("labels the producer's default rate as a benchmark", () => {
    expect(rateSourceLabel("default")).toBe("Industry benchmark");
  });
  it("the Sales path page lists the catalogue as a plain table, with no run status", () => {
    const src = readFileSync(join(__dirname, "../src/components/v2/offer-sales-path-page.tsx"), "utf8");
    expect(src).toContain('getOfferSalesPaths(brandId, offerId, "catalogue")');
    expect(src).toContain('["offerSalesPaths", brandId, offerId, "catalogue"]');
    expect(src).toMatch(/<OfferSalesPaths[^>]*\btable\b/);
    expect(src).not.toContain("activeKey");
  });
});

describe("offer sales paths reader", () => {
  it("parses the served body and keeps its order", () => {
    const parsed = parseOfferSalesPaths(body, "t");
    expect(parsed.paths[0].rank).toBe(1);
    expect(pathTitle(parsed.paths[0])).toBe("Positive reply → Paid client");
  });
  it("reads a path leg by leg: the channel working a leg, then the step it lands on", () => {
    const parsed = parseOfferSalesPaths(body, "t");
    const leg0 = parsed.paths[0].legs[0];
    const human = { ...leg0, legKey: "conversation_to_paid_client", fromStep: step("conversation", "Positive reply"), toStep: step("paid_client", "Paid client"), workedBy: "human", channel: null };
    expect(pathLinks({ ...parsed.paths[0], legs: [leg0, human] })).toEqual([
      { kind: "channel", name: "Herald", slug: "sales-cold-email-outreach", managed: undefined },
      { kind: "step", label: "Positive reply" },
      { kind: "step", label: "Paid client" },
    ]);
  });
  it("accepts a vocabulary it does not know yet", () => {
    expect(() => parseOfferSalesPaths({ ...body, status: "brand_new_status" }, "t")).not.toThrow();
    expect(rateSourceLabel("brand_new_source")).toBe("brand_new_source");
  });
  it("throws on a broken body", () => {
    expect(() => parseOfferSalesPaths({ offerId: "o1" }, "t")).toThrow();
  });
  it("states why there is no path", () => {
    expect(salesPathsEmptyReason("ok")).toBeNull();
    expect(salesPathsEmptyReason("no_legs_selected")).toMatch(/Tick/);
    expect(salesPathsEmptyReason("no_complete_path")).toMatch(/paying client/);
  });
  it("names every rate source and roi reason", () => {
    expect(rateSourceLabel("industry_default")).toBe("Industry benchmark");
    expect(rateSourceLabel("crm_measured")).toBe("Measured in your CRM");
    expect(roiUnavailableLabel(null)).toBeNull();
    expect(roiUnavailableLabel("no_lifetime_revenue")).toMatch(/lifetime revenue/);
  });
  it("formats a rate", () => {
    expect(formatRatePct(null)).toBe("—");
    expect(formatRatePct(2.5)).toBe("3%");
    expect(formatRatePct(0.45)).toBe("0.5%");
    expect(formatRatePct(0.04)).toBe("0.04%");
    expect(formatRatePct(0.97)).toBe("1%");
    expect(formatRatePct(4)).toBe("4%");
    expect(formatRatePct(62.4)).toBe("62%");
  });
});

describe("brand sales budget", () => {
  it("reads the mode, never a null", () => {
    expect(globalBudgetUsd(parseBrandSalesBudget({ brandId: "b", mode: "campaigns", dailyBudgetCents: null, updatedAt: null }, "t"))).toBeNull();
    expect(globalBudgetUsd(parseBrandSalesBudget({ brandId: "b", mode: "global", dailyBudgetCents: "5000.0000000000", updatedAt: "x" }, "t"))).toBe(50);
    expect(globalBudgetUsd(parseBrandSalesBudget({ brandId: "b", mode: "global", dailyBudgetCents: "0", updatedAt: "x" }, "t"))).toBe(0);
  });
  it("parses the field as whole dollars", () => {
    expect(parseBudgetInput("50")).toEqual({ cents: 5000 });
    expect(parseBudgetInput("$1,200")).toEqual({ cents: 120000 });
    expect(parseBudgetInput("0")).toEqual({ cents: 0 });
    expect("error" in parseBudgetInput("")).toBe(true);
    expect("error" in parseBudgetInput("12.5")).toBe(true);
  });
});

describe("sales path page wiring", () => {
  const page = readFileSync(join(__dirname, "../src/components/v2/offer-sales-path-page.tsx"), "utf8");
  it("mounts the campaigns and the paths, and no budget card (owner 2026-10-05)", () => {
    expect(page).toContain("<OfferCampaigns");
    expect(page).toContain("<OfferSalesPaths");
    expect(page).not.toContain("BrandSalesBudgetCard");
  });
  it("re-reads the paths after every save", () => {
    expect(page).toContain('queryKey: ["offerSalesPaths", brandId, offerId]');
  });
  it("draws the served order without sorting", () => {
    const comp = readFileSync(join(__dirname, "../src/components/v2/offer-sales-paths.tsx"), "utf8");
    expect(comp).not.toContain(".sort(");
  });
});

describe("pathStepReach", () => {
  const measured = (fromReached: number | null, toReached: number | null) => ({
    measured: { basis: "our_leads", fromReached, toReached, ratePct: null, sufficient: true },
    customerStatedPct: null,
    fleetMedian: { ratePct: null, brandCount: 0 },
    industryDefaultPct: null,
  });
  const base = parseOfferSalesPaths(body, "test").paths[0];
  const entry = { ...base.legs[0], rateInputs: null };
  const next = { ...base.legs[0], legKey: "conversation_to_paid_client", fromStep: step("conversation", "Positive reply"), toStep: step("paid_client", "Paid client"), rateInputs: measured(26, 6) };

  it("reads the entry step off the next leg and each later step off the leg landing on it", () => {
    const rows = pathStepReach({ ...base, legs: [entry, next] });
    expect(rows.map((r) => [r.step.key, r.reached])).toEqual([
      ["conversation", 26],
      ["paid_client", 6],
    ]);
  });

  it("states null when nothing was measured, never zero", () => {
    const rows = pathStepReach({ ...base, legs: [entry, { ...next, rateInputs: null }] });
    expect(rows.map((r) => r.reached)).toEqual([null, null]);
  });
});

describe("Sales path page: expected figures say so (owner 2026-10-05)", () => {
  const read = (rel: string) => readFileSync(join(__dirname, "..", rel), "utf8");
  it("every expected-value column header carries the (i)", () => {
    const paths = read("src/components/v2/offer-sales-paths.tsx");
    expect(paths).toContain("<ExpectedLabel tip={EXPECTED_ROI_TIP}>ROI</ExpectedLabel>");
    expect(paths.split("<ExpectedLabel tip={EXPECTED_COST_PER_CLIENT_TIP}>Cost per paying client</ExpectedLabel>").length).toBe(3);
    expect(paths).toContain("<InfoTooltip tip={tip}");
    const campaigns = read("src/components/v2/offer-campaigns.tsx");
    expect(campaigns).toContain("<ExpectedLabel tip={EXPECTED_ROI_TIP}>ROI</ExpectedLabel>");
  });
});

describe("Sales path page: a row's detail edits its rates and lifetime revenue (owner 2026-10-05)", () => {
  const page = readFileSync(join(__dirname, "../src/components/v2/offer-sales-path-page.tsx"), "utf8");
  it("passes both editors to the table, as the onboarding does", () => {
    const at = page.indexOf("<OfferSalesPaths");
    const call = page.slice(at, page.indexOf("/>", at));
    expect(call).toContain("onStateRate={onStateRate}");
    expect(call).toContain("onStateLifetimeRevenue={onStateLifetimeRevenue}");
  });
  it("writes the brand's rate and the offer's lifetime revenue, then re-reads the paths", () => {
    expect(page).toContain("stateBrandLegRates(brandId,");
    expect(page).toContain("saveOfferLifetimeRevenue(brandId, offerId, usd)");
    expect(page.split('qc.refetchQueries({ queryKey: ["offerSalesPaths", brandId, offerId] })').length).toBe(3);
  });
});
