import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatRatePct,
  parseOfferSalesPaths,
  pathTitle,
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

describe("offer sales paths reader", () => {
  it("parses the served body and keeps its order", () => {
    const parsed = parseOfferSalesPaths(body, "t");
    expect(parsed.paths[0].rank).toBe(1);
    expect(pathTitle(parsed.paths[0])).toBe("Positive reply → Paid client");
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
    expect(formatRatePct(2.5)).toBe("2.5%");
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
  it("mounts the paths and the budget", () => {
    expect(page).toContain("<OfferSalesPaths");
    expect(page).toContain("<BrandSalesBudgetCard");
  });
  it("re-reads the paths after every save", () => {
    expect(page).toContain('queryKey: ["offerSalesPaths", brandId, offerId]');
  });
  it("draws the served order without sorting", () => {
    const comp = readFileSync(join(__dirname, "../src/components/v2/offer-sales-paths.tsx"), "utf8");
    expect(comp).not.toContain(".sort(");
  });
});
