import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SalesFunnelCampaignListSchema,
  splitFunnelCampaigns,
  type SalesFunnelCampaign,
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
  volumeLimitLabel,
  volumeFundingLabel,
  funnelFunded,
  fundingLimit,
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
    // Its money reads as its campaign's caps (the per-campaign ceiling is retired).
    expect(page).not.toContain("CampaignSettingsCard");
    expect(page).toContain("useFunnelCapsWords(brandId, partOfId)");
  });

  it("parts are their own identity and never stand in for an old campaign's row", () => {
    expect(src("src/components/campaigns/campaigns-table.tsx")).toContain("|${c.salesFunnelCampaignId ?? \"\"}`;");
    expect(src("src/components/v2/offer-campaigns.tsx")).toContain("if (c.salesFunnelCampaignId) continue;");
  });

  it("Campaigns lists funnel campaigns: the overview section and the sidebar's ON ones", () => {
    expect(src("src/components/v2/campaigns-overview-page.tsx")).toContain("<FunnelCampaignsSection orgId={orgId} brandId={brandId} offerId={offerId} />");
    const shell = src("src/components/v2/v2-shell.tsx");
    expect(shell).toContain("const { campaigns: ongoing, funnelCampaigns } = useOngoingCampaigns(orgId, brandId, offerId);");
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
    expect(outcomes).toContain("funnelCampaigns={listed.funnelCampaigns}");
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

  it("the Campaigns page lists ONLY funnel campaigns, staff mode included (no pipe table, owner 2026-10-11)", () => {
    const overview = src("src/components/v2/campaigns-overview-page.tsx");
    expect(overview).not.toContain("StaffPipeCampaigns");
    expect(overview).not.toContain("staffMode");
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


describe("Campaigns table, owner spec 2026-10-11", () => {
  const funnel = () => src("src/components/v2/funnel-campaigns.tsx");
  const section = () => funnel().slice(funnel().indexOf("export function FunnelCampaignsSection("), funnel().indexOf("function FunnelCampaignRow("));

  it("columns, in order: Campaign, Type (i), ROI, $ Invested, Status; Spent / Volume / Budget dropped", () => {
    const s = section();
    const at = (t: string) => s.indexOf(t);
    expect(at(">Campaign</th>")).toBeGreaterThan(-1);
    expect(at("Type")).toBeGreaterThan(at(">Campaign</th>"));
    expect(at("<InfoTooltip tip={TYPE_TIP}")).toBeGreaterThan(at("Type"));
    // ROI carries the expected (i) (owner 2026-10-11).
    expect(at("<RoiLabel />")).toBeGreaterThan(at("<InfoTooltip tip={TYPE_TIP}"));
    expect(at(">$ Invested</th>")).toBeGreaterThan(at("<RoiLabel />"));
    expect(at(">Status</th>")).toBeGreaterThan(at(">$ Invested</th>"));
    for (const gone of [">Spent</th>", ">Volume</th>", ">Budget</th>"]) expect(s).not.toContain(gone);
  });

  it("every cell reads features-service's served row: path items, type label, roiMultiple, investedUsd; nothing composed", () => {
    const f = funnel();
    // Path on the fast copy read (the full row's when present), INSTANT-CAMPAIGN-ROWS 2026-10-13.
    expect(f).toContain("<FunnelPathLine items={copy.path.items} />");
    expect(f).toContain("{row.typeLabel}");
    expect(f).toContain("funnelRoiShown(row)");
    expect(f).toContain("formatUsdAdaptive(row.investedUsd)");
    expect(f).not.toContain("row.description");
    expect(src("src/lib/api.ts")).toContain("/features/brands/${encodeURIComponent(brandId)}/sales-funnel-campaigns?");
  });

  it("Status is the on/off control: green with the budget when on (Up to for Reactive), Off otherwise; not funded keeps its handling", () => {
    const f = funnel();
    expect(f).toContain('`${reactive ? "Up to " : ""}${maxBudgetLabel(b)}`');
    expect(f).toContain("<FunnelCampaignStatus campaign={campaign} onLabel={onLabel} />");
    expect(f).toContain("Not funded yet · Set a budget");
  });

  it("a missing served field reads — and is logged by name", () => {
    const f = funnel();
    expect(f).toContain('"[funnel-campaigns] roiMultiple not served"');
    expect(f).toContain('"[funnel-campaigns] investedUsd not served"');
  });

  it("the mark beside two lines is as tall as the lines (MarkLines, one primitive)", () => {
    expect(src("src/components/v2/ui.tsx")).toContain("export function MarkLines(");
    expect(funnel()).toContain("<MarkLines mark={(px) => <FunnelFace name={campaign.salesFunnelName} size={px} />}>");
  });
});

describe("ROI cell: a null ROI always says why (owner 2026-10-11)", () => {
  it("maturing reads Learning; an unpriced pipeline reads Not priced yet; a served ROI reads itself", async () => {
    const { funnelRoiShown, unpricedWords } = await import("../src/lib/sales-funnel-campaigns");
    const base = { roiMultiple: null, maturity: null, costEconomics: null, headline: null, moneyUnavailableReason: null };
    expect(funnelRoiShown({ ...base, maturity: { isMature: false }, costEconomics: { unmeasuredReason: "maturing" } })).toMatchObject({ learning: true });
    const unpriced = funnelRoiShown({ ...base, headline: { unpricedReason: "no_funnel_wired" } });
    expect(unpriced).toMatchObject({ learning: false, value: null, unpriced: "no_funnel_wired" });
    expect(unpricedWords(unpriced.unpriced)).toBe("Not priced yet");
    expect(funnelRoiShown({ ...base, roiMultiple: 2.5, maturity: { isMature: true } })).toMatchObject({ value: 2.5 });
  });
});


describe("Campaigns order + one modal (owner 2026-10-11)", () => {
  it("proactive first, then max budget desc (per-day pace, totals after), then max volume desc", async () => {
    const { compareFunnelCampaigns } = await import("../src/lib/sales-funnel-campaigns");
    const k = (type: "proactive" | "reactive" | null, budget: [number, string] | null, volume: [number, string] | null = null) => ({
      type,
      budget: budget && { amount: budget[0], period: budget[1] },
      volume: volume && { count: volume[0], period: volume[1] },
    });
    const rows = {
      reactiveBig: k("reactive", [500, "daily"]),
      proSmall: k("proactive", [50, "weekly"]),
      proBig: k("proactive", [20, "daily"]),
      proMonthly: k("proactive", [300, "monthly"]),
      proTotal: k("proactive", [5000, "one_off"]),
      proNone: k("proactive", null),
      proTieMoreVolume: k("proactive", [140, "weekly"], [100, "daily"]),
      proTieLessVolume: k("proactive", [20, "daily"], [100, "weekly"]),
    };
    const order = Object.entries(rows)
      .sort((a, b) => compareFunnelCampaigns(a[1], b[1]))
      .map(([n]) => n);
    expect(order).toEqual(["proTieMoreVolume", "proTieLessVolume", "proBig", "proMonthly", "proSmall", "proTotal", "proNone", "reactiveBig"]);
  });

  it("the Status button opens the campaign's one modal (switch + both limits, one Save); no on/off menu left", () => {
    const f = src("src/components/v2/funnel-campaigns.tsx");
    const status = f.slice(f.indexOf("export function FunnelCampaignStatus("), f.indexOf("export function FunnelLimitsButton("));
    expect(status).toContain('aria-haspopup="dialog"');
    expect(status).toContain("<FunnelCampaignModal campaign={campaign}");
    expect(status).not.toContain('role="menu"');
    const modal = f.slice(f.indexOf("export function FunnelCampaignModal("), f.indexOf("/** What the max budget consumed this period"));
    expect(modal).toContain("<RunSwitch on={on} onChange={setOn} />");
    expect(modal).toContain('id="v2-funnel-budget"');
    expect(modal).toContain('id="v2-funnel-volume"');
    // Limits are written before the status, so turning on with a first budget starts funded.
    expect(modal.indexOf("saveSalesFunnelCaps(")).toBeLessThan(modal.indexOf("setSalesFunnelCampaignStatus("));
    expect(f).not.toContain("FunnelLimitsModal");
  });

  it("the table renders campaigns in that order", () => {
    const f = src("src/components/v2/funnel-campaigns.tsx");
    expect(f).toContain(".sort((x, y) => compareFunnelCampaigns(x.k, y.k))");
  });
});

describe("path: a channel between every two steps (owner correction 2026-10-11)", () => {
  it("finds every step pair served with no channel; a full path has none", async () => {
    const { missingChannelGaps } = await import("../src/lib/sales-funnel-campaigns");
    const step = (label: string) => ({ kind: "step" as const, key: label, label });
    const ch = (name: string) => ({ kind: "channel" as const, slug: name, name });
    expect(missingChannelGaps([step("Lead found"), ch("Sales Cold Email Outreach"), step("Positive reply"), ch("Your team: closing calls"), step("Paid client")])).toEqual([]);
    expect(missingChannelGaps([step("Lead found"), ch("Cold email"), step("Positive reply"), step("Paid client")])).toEqual([{ from: "Positive reply", to: "Paid client" }]);
  });

  it("the path line never skips a gap silently: it logs and draws it", () => {
    const f = src("src/components/v2/funnel-campaigns.tsx");
    expect(f).toContain('"[funnel-campaigns] a leg of the path is served with no channel"');
    expect(f).toContain('it.kind === "step" && items[i - 1].kind === "step"');
  });
});

describe("path: several channels on one leg read as one group (owner 2026-10-11)", () => {
  it("no arrow between two channels of the same leg; a gap is only step after step", async () => {
    const { missingChannelGaps } = await import("../src/lib/sales-funnel-campaigns");
    const step = (label: string) => ({ kind: "step" as const, key: label, label });
    const ch = (name: string) => ({ kind: "channel" as const, slug: name, name });
    expect(missingChannelGaps([step("Start"), ch("Apollo"), ch("LinkedIn"), ch("CRM"), step("Lead found")])).toEqual([]);
    expect(src("src/components/v2/funnel-campaigns.tsx")).toContain('!(it.kind === "channel" && items[i - 1].kind === "channel")');
  });
});

describe("path: a reactive path starts with its trigger tag (owner 2026-10-11)", () => {
  it("parses a trigger item and draws it as one lightning tag", async () => {
    const { FunnelCampaignRowsSchema, missingChannelGaps } = await import("../src/lib/sales-funnel-campaigns");
    const items = [
      { kind: "trigger", slug: "positive_reply", name: "Positive Reply" },
      { kind: "channel", slug: "ai-meeting-booking", name: "AI Meeting Booking" },
      { kind: "step", key: "meeting_booked", label: "Meeting booked" },
    ];
    const parsed = FunnelCampaignRowsSchema.parse({
      salesFunnelCampaigns: [{ id: "x", salesFunnelId: "f", name: "Motivate", status: "ongoing", type: "reactive", typeLabel: "Positive replies", path: { items }, investedUsd: 0, roiMultiple: null, costEconomics: null }],
    });
    expect(parsed.salesFunnelCampaigns[0].path?.items[0].kind).toBe("trigger");
    expect(missingChannelGaps(parsed.salesFunnelCampaigns[0].path!.items)).toEqual([]);
    expect(src("src/components/v2/funnel-campaigns.tsx")).toContain('it.kind === "trigger" ? (');
  });
});

describe("a max budget AND/OR a max volume funds a funnel (owner 2026-10-11, billing `funded`)", () => {
  const vol = { count: 200, unit: "first_contacts", period: "monthly", consumed: 12, remaining: 188, periodStart: "2026-10-01", periodEnd: null, reached: false, consumedUnavailableReason: null, consumedUnavailableDetail: null };
  const bud = { amountCents: "5000", consumedCents: "0", remainingCents: "5000", period: "weekly", periodStart: "2026-10-06", periodEnd: null, reached: false, consumedUnavailableReason: null, consumedUnavailableDetail: null };

  it("reads billing's verdict; an absent one is unknown (null), never not funded", () => {
    expect(funnelFunded({ salesFunnelId: "f", funded: true })).toBe(true);
    expect(funnelFunded({ salesFunnelId: "f", funded: false })).toBe(false);
    expect(funnelFunded({ salesFunnelId: "f" })).toBeNull();
    expect(funnelFunded(null)).toBeNull();
  });

  it("a volume-only funnel's limit is its max volume, never a $ figure; nothing stated has no limit", () => {
    expect(fundingLimit({ maxBudget: null, maxVolume: vol, fundedBy: "max_volume" })).toEqual({ kind: "volume", volume: vol });
    expect(fundingLimit({ maxBudget: bud, maxVolume: vol, fundedBy: "both" })).toEqual({ kind: "budget", budget: bud });
    expect(fundingLimit({ maxBudget: bud, maxVolume: null, fundedBy: "max_budget" })).toEqual({ kind: "budget", budget: bud });
    expect(fundingLimit({ maxBudget: null, maxVolume: null, fundedBy: null })).toBeNull();
    expect(volumeLimitLabel("proactive", vol)).toBe("200 new people/month");
    // Owner 2026-10-11: a volume-only limit reads "100 new people/month", never "Max 100 ...".
    expect(volumeFundingLabel("proactive", vol)).toBe("200 new people/month");
    expect(volumeFundingLabel("reactive", { count: 50, unit: "prospects_handled", period: "weekly" })).toBe("Up to 50 leads handled/week");
    const f = src("src/components/v2/funnel-campaigns.tsx");
    expect(f).not.toContain("statedVolume(type, limit.volume)");
    expect(f).not.toContain("v ? statedVolume(type, v) : notFunded");
    expect(statedVolume("reactive", { count: 50, unit: "prospects_handled", period: "weekly" })).toBe("Up to 50 leads handled/week");
  });

  it("the schema keeps billing's funded + fundedBy", () => {
    const parsed = SalesFunnelCapsSchema.parse({ salesFunnelId: "f", stated: true, updatedAt: null, funded: true, fundedBy: "max_volume", maxBudget: null, maxVolume: vol });
    expect(parsed.funded).toBe(true);
    expect(parsed.fundedBy).toBe("max_volume");
  });

  it("every Not funded yet reads billing's verdict, and the modal saves a volume alone", () => {
    const f = src("src/components/v2/funnel-campaigns.tsx");
    expect(f.match(/funnelFunded\((c|caps|caps\.data \?\? null)\) === false/g)?.length).toBe(3);
    expect(f).not.toContain("c.maxBudget === null");
    expect(f).toContain('"Set a budget or a volume."');
    expect(f).toContain("maxBudget: usd === null ? null : { amountCents: usd * 100, period: budgetPer }");
  });
});

describe("Running vs Past campaigns (owner 2026-10-13)", () => {
  const c = (id: string, status: string) => ({ id, status }) as Pick<SalesFunnelCampaign, "id" | "status">;
  it("ON campaigns are Running; stopped ones are Past only with at least 1 cent invested", () => {
    const invested = new Map<string, number | null>([["on", 0], ["spent", 3], ["cent", 0.01], ["zero", 0], ["null", null]]);
    const { running, past } = splitFunnelCampaigns([c("on", "ongoing"), c("spent", "stopped"), c("cent", "stopped"), c("zero", "stopped"), c("null", "stopped"), c("unserved", "stopped")], invested);
    expect(running.map((x) => x.id)).toEqual(["on"]);
    expect(past.map((x) => x.id)).toEqual(["spent", "cent"]);
  });
  it("the Campaigns section lists running by default, the Past tab only when it holds one", () => {
    const page = src("src/components/v2/funnel-campaigns.tsx");
    expect(page).toContain("splitFunnelCampaigns(campaigns, investedById)");
    expect(page).toContain("{settled && past.length > 0 && (");
    expect(page).toContain("const shown = showingPast ? past : running;");
    expect(page).toContain("{shown.map((c) => (");
  });
});
