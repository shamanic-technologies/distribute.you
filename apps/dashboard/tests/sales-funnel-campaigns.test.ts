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
  capWords,
  funnelTypeOf,
  statedBudget,
  statedVolume,
  volumeUnitWords,
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
    expect(funnelCampaignFaceSrc("Epiphany")).toBe("/api/public/faces/Epiphany.svg");
    expect(funnelCampaignFaceSrc("New Dawn")).toBe("/api/public/faces/New%20Dawn.svg");
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
    expect(shell).toContain("const { campaigns: ongoing, funnelCampaigns, outcomes } = useOngoingCampaigns(orgId, brandId, offerId);");
    expect(shell).toContain("funnelCampaigns.map((c) => {");
  });

  it("a part is never LISTED as a campaign: filtered once at the source every listing surface reads", () => {
    const missions = src("src/components/v2/use-missions.ts");
    expect(missions).toContain("const missions = useMemo(() => allMissions.filter((m) => !m.row.campaign.salesFunnelCampaignId), [allMissions]);");
    // Lookups by id keep the parts (a part's own page, a lead's campaign, the funnel page's results).
    expect(missions).toContain("for (const m of allMissions) out.set(m.row.campaign.id, m);");
    const ongoing = src("src/components/v2/ongoing-campaigns.ts");
    expect(ongoing).toContain("const campaigns = useMemo(() => running.filter((c) => !c.m.row.campaign.salesFunnelCampaignId), [running]);");
    expect(ongoing).toContain("if (funnel && !hit.funnelCampaigns.some((f) => f.id === funnel.id)) hit.funnelCampaigns.push(funnel);");
  });

  it("Today and Outcomes name a funnel campaign once, by face and name", () => {
    const today = src("src/components/v2/today-page.tsx");
    expect(today).toContain("<FunnelCampaignLine key={f.id} orgId={orgId} campaign={f} />");
    expect(today).toContain("ongoing.campaigns.length + ongoing.funnelCampaigns.length");
    const outcomes = src("src/components/v2/outcomes-page.tsx");
    expect(outcomes).toContain("funnelCampaigns={o.funnelCampaigns}");
    expect(outcomes).toContain("funnelCampaigns={running.funnelCampaigns}");
  });

  it("a campaign page never waits on the funnel list, and the list paints from disk", () => {
    const page = src("src/components/v2/campaign-page.tsx");
    const route = page.slice(page.indexOf("export function V2CampaignRoute()"), page.indexOf("export function V2CampaignPage("));
    expect(route).toContain("return <V2CampaignPage funnelListSettled={funnel.settled} />;");
    expect(route).not.toContain("<Shimmer");
    expect(page).toContain("if (settled && !mission && !funnelListSettled) {");
    const persist = src("src/lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    const persistable = persist.slice(persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    for (const root of ['"salesFunnelCampaigns"', '"salesFunnelCampaign"', '"salesFunnelCaps"']) {
      expect(sensitive).not.toContain(root);
      expect(persistable).toContain(root);
    }
  });
});

describe("sales funnel campaigns: the type picks the words (owner 2026-10-10)", () => {
  it("Proactive asks Max budget / Max volume; Reactive asks Up to $X / Up to N <unit>", () => {
    expect(capWords("proactive")).toMatchObject({ budget: "Max budget", volume: "Max volume" });
    expect(statedBudget("proactive", { amountCents: "5000", period: "weekly" })).toBe("Max $50/week");
    expect(statedBudget("reactive", { amountCents: "3000", period: "monthly" })).toBe("Up to $30/month");
    expect(statedVolume("proactive", { count: 200, period: "monthly", unit: "first_contacts" })).toBe("Max 200 new people/month");
    expect(statedVolume("reactive", { count: 40, period: "one_off", unit: "prospects_handled" })).toBe("Up to 40 leads handled in total");
  });

  it("reads billing's relayed type, never derives it; unknown = neutral words, logged", () => {
    expect(funnelTypeOf({ salesFunnelType: "reactive", salesFunnelTypeUnavailableReason: null })).toBe("reactive");
    expect(funnelTypeOf({ salesFunnelType: null, salesFunnelTypeUnavailableReason: "sales_funnel_catalogue_unavailable" })).toBeNull();
    expect(capWords(null)).toMatchObject({ budget: "Budget", prefix: "" });
    const page = src("src/components/v2/funnel-campaigns.tsx");
    expect(page).not.toMatch(/\.mode === "proactive"/);
  });

  it("billing's volume unit, in words", () => {
    expect(volumeUnitWords("first_contacts", "proactive", 1)).toBe("new person");
    expect(volumeUnitWords("prospects_handled", "reactive", 3)).toBe("leads handled");
    expect(volumeUnitWords(null, "reactive", 3)).toBe("leads handled");
  });

  it("a customer's Campaigns page lists ONLY funnel campaigns; the pipe table is staff mode", () => {
    const overview = src("src/components/v2/campaigns-overview-page.tsx");
    expect(overview).toContain("<StaffPipeCampaigns orgId={orgId} brandId={brandId} offerId={offerId} />");
    // Until campaign-service has converted it, a RUNNING old-style campaign stays in view, and only it.
    expect(overview).toContain("<UnconvertedRunningCampaigns orgId={orgId} brandId={brandId} offerId={offerId} />");
    expect(overview).toContain("if (running.size === 0) return null;");
    const page = overview.slice(overview.indexOf("export function CampaignsOverviewPage()"), overview.indexOf("function UnconvertedRunningCampaigns("));
    expect(page).not.toContain("<OfferCampaigns");
    // The funnel page's results read what a part brings in, no leg arrows.
    const funnel = src("src/components/v2/funnel-campaigns.tsx");
    expect(funnel).not.toContain("<CampaignLeg");
  });
});

