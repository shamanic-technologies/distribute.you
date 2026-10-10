import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SalesFunnelCampaignListSchema,
  SalesFunnelCapsSchema,
  capPeriodSuffix,
  capUnavailableSentence,
  capWindowWords,
  centsToUsd,
  formatCapUsd,
  funnelCampaignFaceSrc,
  isOngoingFunnelCampaign,
  maxBudgetLabel,
  maxVolumeLabel,
  parseWholeAmount,
} from "../src/lib/sales-funnel-campaigns";

const parseSalesFunnelCampaigns = (raw: unknown) => SalesFunnelCampaignListSchema.parse(raw).salesFunnelCampaigns;
const parseSalesFunnelCaps = (raw: unknown) => SalesFunnelCapsSchema.parse(raw);

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Captured from prod (campaign-service v0.75.15, billing v0.83.6 through the gateway), 2026-10-10.
const LIST = {
  salesFunnelCampaigns: [
    {
      id: "a5a5f05c-17f2-458a-a886-e620f5dff10d",
      orgId: "f0420eb5-8f72-4f0a-a150-f473746df1e6",
      brandId: "f4d73dab-1f9d-49b2-b16e-63ecde76a5eb",
      offerId: "6d31b8d5-924c-4f49-9d75-764d9a417d36",
      salesFunnelId: "lead_found_to_website_visit@sales-cold-email-outreach+website_visit_to_purchase+purchase_to_paid_client",
      salesFunnelName: "Epiphany",
      status: "stopped",
      stopReason: "manual",
      createdByUserId: null,
      createdAt: "2026-10-10T10:37:24.567Z",
      updatedAt: "2026-10-10T10:37:24.567Z",
      units: [
        {
          campaignId: "71a76c3d-4b60-4212-a8dc-fb849395c9da",
          pipeId: "sales-cold-email-outreach|lead_found_to_website_visit",
          featureSlug: "sales-cold-email-outreach",
          legKey: "lead_found_to_website_visit",
          status: "stopped",
          workflowSlug: "sales-cold-email-outreach-azha",
          name: "Epiphany a5a5f05c - sales-cold-email-outreach",
        },
      ],
    },
  ],
};

const CAPS = {
  orgId: "f0420eb5-8f72-4f0a-a150-f473746df1e6",
  brandId: "f4d73dab-1f9d-49b2-b16e-63ecde76a5eb",
  offerId: "6d31b8d5-924c-4f49-9d75-764d9a417d36",
  salesFunnelId: "x",
  stated: true,
  updatedAt: "2026-10-10T12:00:00.000Z",
  salesFunnelName: "Epiphany",
  maxBudget: {
    amountCents: "5000",
    period: "weekly",
    periodStart: "2026-10-05T00:00:00.000Z",
    periodEnd: "2026-10-12T00:00:00.000Z",
    consumedCents: "0",
    remainingCents: "5000",
    reached: false,
    consumedUnavailableReason: null,
    consumedUnavailableDetail: null,
  },
  maxVolume: {
    count: 200,
    period: "monthly",
    unit: "first_contacts",
    periodStart: "2026-10-01T00:00:00.000Z",
    periodEnd: "2026-11-01T00:00:00.000Z",
    consumed: null,
    remaining: null,
    reached: null,
    consumedUnavailableReason: "volume_not_measured_on_channel",
    consumedUnavailableDetail: "x",
  },
  pipes: [],
  sources: [],
};

describe("sales funnel campaigns: readers", () => {
  it("parses the list, keeping every served field the page reads", () => {
    const [c] = parseSalesFunnelCampaigns(LIST);
    expect(c.salesFunnelName).toBe("Epiphany");
    expect(c.units[0].campaignId).toBe("71a76c3d-4b60-4212-a8dc-fb849395c9da");
    expect(isOngoingFunnelCampaign(c)).toBe(false);
    expect(isOngoingFunnelCampaign({ status: "ongoing" })).toBe(true);
  });

  it("fails loud on a missing required field", () => {
    const broken = { salesFunnelCampaigns: [{ ...LIST.salesFunnelCampaigns[0], salesFunnelName: undefined }] };
    expect(() => parseSalesFunnelCampaigns(broken)).toThrow();
  });

  it("reads billing's string cents and keeps an unmeasured consumption null, never 0", () => {
    const caps = parseSalesFunnelCaps(CAPS);
    expect(centsToUsd(caps.maxBudget?.amountCents)).toBe(50);
    expect(formatCapUsd("5000.0000000000")).toBe("$50");
    expect(centsToUsd(caps.maxBudget?.consumedCents)).toBe(0);
    expect(caps.maxVolume?.consumed).toBeNull();
    expect(caps.maxVolume?.consumedUnavailableReason).toBe("volume_not_measured_on_channel");
  });

  it("accepts a funnel with no cap stated", () => {
    const caps = parseSalesFunnelCaps({ ...CAPS, stated: false, updatedAt: null, maxBudget: null, maxVolume: null });
    expect(caps.maxBudget).toBeNull();
  });
});

describe("sales funnel campaigns: display", () => {
  it("states a cap in the period it was stated in", () => {
    expect(maxBudgetLabel({ amountCents: "5000", period: "weekly" })).toBe("$50/week");
    expect(maxBudgetLabel({ amountCents: "30000.0000000000", period: "one_off" })).toBe("$300 in total");
    expect(maxVolumeLabel({ count: 200, period: "monthly" })).toBe("200 people/month");
    expect(maxVolumeLabel({ count: 1, period: "daily" })).toBe("1 person/day");
    expect(capPeriodSuffix("daily")).toBe("/day");
    expect(capWindowWords("weekly")).toBe("this week");
    expect(capWindowWords("one_off")).toBe("so far");
  });

  it("draws the face from the name through the gateway's public route", () => {
    expect(funnelCampaignFaceSrc("Epiphany")).toBe("/api/v1/public/catalogue/faces/Epiphany.svg");
    expect(funnelCampaignFaceSrc("New Dawn")).toBe("/api/v1/public/catalogue/faces/New%20Dawn.svg");
  });

  it("says why a consumption is missing in plain words", () => {
    expect(capUnavailableSentence("volume_not_measured_on_channel")).toBe("Not counted on this channel yet.");
    expect(capUnavailableSentence("runs_service_unavailable")).toBe("Could not count this right now.");
  });

  it("reads whole dollars only", () => {
    expect(parseWholeAmount("$1,200")).toBe(1200);
    expect(parseWholeAmount("12.5")).toBeNull();
    expect(parseWholeAmount("0")).toBeNull();
  });

  it("no customer copy says funnel, pipe or leg", () => {
    const page = src("src/components/v2/funnel-campaigns.tsx");
    // JSX text nodes and string literals rendered on screen; identifiers are code, not copy.
    const copy = [...page.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map((m) => m[1].trim()).filter(Boolean);
    for (const line of copy) expect(line).not.toMatch(/\b(funnel|pipe|leg)s?\b/i);
  });
});

describe("sales funnel campaigns: wiring", () => {
  it("the campaign route serves a funnel campaign before the campaign page", () => {
    const route = src("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/campaigns/[campaignId]/page.tsx");
    expect(route).toContain("<V2CampaignRoute />");
    const page = src("src/components/v2/campaign-page.tsx");
    expect(page).toContain("if (funnel.campaign) return <FunnelCampaignPage campaign={funnel.campaign} />;");
  });

  it("a part of a funnel campaign offers no status or budget control of its own", () => {
    const page = src("src/components/v2/campaign-page.tsx");
    expect(page).toContain("<FunnelPartOf orgId={orgId} campaign={partOf.campaign} />");
    expect(page).toContain("{!partOfId && <CampaignSettingsCard");
  });

  it("parts are their own identity and never stand in for an old campaign's row", () => {
    expect(src("src/components/campaigns/campaigns-table.tsx")).toContain("|${c.salesFunnelCampaignId ?? \"\"}`;");
    expect(src("src/components/v2/offer-campaigns.tsx")).toContain("if (c.salesFunnelCampaignId) continue;");
  });

  it("Campaigns lists funnel campaigns: the overview section and the sidebar's ON ones", () => {
    expect(src("src/components/v2/campaigns-overview-page.tsx")).toContain("<FunnelCampaignsSection orgId={orgId} brandId={brandId} offerId={offerId} />");
    const shell = src("src/components/v2/v2-shell.tsx");
    expect(shell).toContain("funnelCampaigns.filter(isOngoingFunnelCampaign)");
    expect(shell).toContain(".filter(({ m }) => !m.row.campaign.salesFunnelCampaignId)");
  });
});
