import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATALOGUE_OBJECTS,
  CatalogueFunnelSchema,
  CataloguePageSchema,
  CataloguePipeSchema,
  canonicalFunnelId,
  catalogueFaceSrc,
  catalogueStatusLabel,
  costUnitLabel,
  isCatalogueObject,
  ongoingChannelsAndSteps,
  ongoingFunnelIds,
  ongoingPipeIds,
} from "../src/lib/staff-catalogue";
import { v2CatalogueHref, v2SectionOf } from "../src/lib/v2/routes";
import { SENSITIVE_QUERY_ROOTS } from "../src/lib/persist-cache";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// Staff sections per business object (owner 2026-10-10): Steps, Sales Paths, Channels,
// Pipes, Sales Funnels (catalogue pages here) and Workflows (their own pages), each an
// overview, the ongoing ones, and a page per object. features-service PR #1482 through
// the gateway's staff-only /v1/catalogue/* (api-service v0.112.78).

describe("ongoing = used by an ON campaign of the offer", () => {
  it("a campaign IS a pipe, in the catalogue's (new outbound) spelling, once each", () => {
    expect(
      ongoingPipeIds([
        { featureSlug: "sales-cold-email-outreach", legKey: "start_to_conversation" },
        { featureSlug: "sales-cold-email-outreach", legKey: "lead_found_to_conversation" },
        { featureSlug: "ai-meeting-booking", legKey: "conversation_to_meeting_booked" },
        { featureSlug: "sourcing-apollo-cold-filters", legKey: "start_to_lead_found" },
        { featureSlug: null, legKey: "x" },
      ]),
    ).toEqual([
      "sales-cold-email-outreach|lead_found_to_conversation",
      "ai-meeting-booking|conversation_to_meeting_booked",
      "sourcing-apollo-cold-filters|start_to_lead_found",
    ]);
  });

  it("a funnel is ongoing when the offer ticked it AND an ON campaign works one of its legs", () => {
    const on = ["sales-cold-email-outreach|lead_found_to_conversation"];
    const paths = [
      {
        combinationKey: "start_to_conversation@sales-cold-email-outreach+conversation_to_paid_client",
        ticked: true,
        legs: [
          { legKey: "start_to_conversation", channel: { slug: "sales-cold-email-outreach" } },
          { legKey: "conversation_to_paid_client", channel: { slug: null } },
        ],
      },
      // Ticked, but no ON campaign works it.
      {
        combinationKey: "lead_found_to_conversation@cold-call-outreach+conversation_to_paid_client",
        ticked: true,
        legs: [{ legKey: "lead_found_to_conversation", channel: { slug: "cold-call-outreach" } }],
      },
      // Worked, but not ticked.
      {
        combinationKey: "lead_found_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked",
        ticked: false,
        legs: [{ legKey: "lead_found_to_conversation", channel: { slug: "sales-cold-email-outreach" } }],
      },
    ];
    expect(ongoingFunnelIds(paths, on)).toEqual(["lead_found_to_conversation@sales-cold-email-outreach+conversation_to_paid_client"]);
  });

  it("a funnel id takes the catalogue spelling per channel, bare legs untouched", () => {
    expect(canonicalFunnelId("start_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked@ai-meeting-booking+meeting_booked_to_paid_client")).toBe(
      "lead_found_to_conversation@sales-cold-email-outreach+conversation_to_meeting_booked@ai-meeting-booking+meeting_booked_to_paid_client",
    );
    // A non-outbound legacy key stays legacy.
    expect(canonicalFunnelId("start_to_website_visit@google-ads+website_visit_to_paid_client")).toBe("start_to_website_visit@google-ads+website_visit_to_paid_client");
  });

  it("channels and steps come off the ongoing pipes' own served fields", () => {
    expect(
      ongoingChannelsAndSteps([
        { channelSlug: "sales-cold-email-outreach", fromStep: "lead_found", toStep: "conversation" },
        { channelSlug: "ai-meeting-booking", fromStep: "conversation", toStep: "meeting_booked" },
        { channelSlug: "sourcing-apollo-cold-filters", fromStep: null, toStep: "lead_found" },
      ]),
    ).toEqual({
      channelIds: ["sales-cold-email-outreach", "ai-meeting-booking", "sourcing-apollo-cold-filters"],
      stepIds: ["lead_found", "conversation", "meeting_booked"],
    });
  });
});

describe("served shapes (captured from features-service v0.179.113 in prod)", () => {
  it("parses a list page and keeps fields it does not name", () => {
    const page = CataloguePageSchema.parse({
      object: "pipe",
      costUnit: "per_outcome",
      order: "roi_desc",
      total: 71,
      truncated: true,
      rows: [
        { id: "sales-cold-email-outreach|lead_found_to_conversation", name: "Jubilation", icon: "bird", color: "#E0784B", line: "Sales Cold Email Outreach: Lead found → Positive reply", mode: "proactive", costUsd: 137.43, roi: 0.91, status: "measured", someNew: 1 },
        { id: "your-team-closing-calls|meeting_attended_to_paid_client", name: "Rise", icon: "bird", color: "#3D7FD0", line: "x", mode: "reactive", costUsd: null, roi: null, status: "customer_time" },
      ],
    });
    expect(page.rows[0]).toMatchObject({ someNew: 1 });
  });
  it("parses a pipe and a funnel detail", () => {
    expect(() =>
      CataloguePipeSchema.parse({
        object: "pipe", id: "ai-meeting-booking|conversation_to_meeting_booked", name: "Prism", icon: "bird", color: "#3FA27E",
        line: "AI Meeting Booking: Positive reply → Meeting booked", channelSlug: "ai-meeting-booking", channelName: "AI Meeting Booking",
        legKey: "conversation_to_meeting_booked", fromStep: "conversation", toStep: "meeting_booked", mode: "reactive",
        triggerId: "positive_reply_received", operatedBy: "platform", managed: true, draft: false, costUsd: null, roi: null,
        status: "learning", learningReason: "no_mature_workflow_yet", costUnit: "per_outcome", toStepValueUsd: 375,
        bestWorkflowSlug: "ai-meeting-booking-rhodium", measuredBasis: "flash", conversionRatePct: 22.2,
      }),
    ).not.toThrow();
    expect(() =>
      CatalogueFunnelSchema.parse({
        object: "sales_funnel", id: "lead_found_to_conversation@sales-cold-email-outreach+conversation_to_paid_client", name: "Zenith",
        face: { animal: "mouse", color: "#FFD3A5", eyes: "wink", mouth: "cat", accessory: "none", svgPath: "/public/catalogue/faces/Zenith.svg" },
        line: "Sales Cold Email Outreach → your team", salesPathId: "lead_found_to_conversation+conversation_to_paid_client", salesPathName: "Ganges",
        legs: [
          { legKey: "lead_found_to_conversation", ratePct: 0.19, outcomesNeededPerPayingClient: 20, pipe: { id: "sales-cold-email-outreach|lead_found_to_conversation", name: "Jubilation", line: "x", mode: "proactive", costUsd: 137.43, roi: 0.91, status: "measured" } },
          { legKey: "conversation_to_paid_client", ratePct: 5, outcomesNeededPerPayingClient: 1, pipe: null },
        ],
        costUsd: 2748.69, roi: 0.91, status: "measured", learningReason: null, costUnit: "per_paying_client", lifetimeRevenueUsd: 2500, draft: false,
      }),
    ).not.toThrow();
  });
});

describe("words and links", () => {
  it("states the producer's words, capitalised, never renamed", () => {
    expect(catalogueStatusLabel("measured")).toBe("Measured");
    expect(catalogueStatusLabel("customer_time")).toBe("Customer time");
    expect(costUnitLabel("per_paying_client")).toBe("Cost per paying client");
  });
  it("a face is the gateway's public face route, through the /api/v1 proxy", () => {
    expect(catalogueFaceSrc("/public/catalogue/faces/Zenith.svg")).toBe("/api/v1/public/catalogue/faces/Zenith.svg");
    expect(catalogueFaceSrc("https://elsewhere/x.svg")).toBeNull();
  });
  it("an id is ONE encoded segment and the section is Catalogue", () => {
    expect(v2CatalogueHref("o", "b", "pipes", "sales-cold-email-outreach|lead_found_to_conversation")).toBe(
      "/v2/orgs/o/brands/b/catalogue/pipes/sales-cold-email-outreach%7Clead_found_to_conversation",
    );
    expect(v2CatalogueHref("o", "b", "sales-paths", "a+b")).toBe("/v2/orgs/o/brands/b/catalogue/sales-paths/a%2Bb");
    expect(v2SectionOf("/v2/orgs/o/brands/b/catalogue/steps")).toBe("catalogue");
    expect(CATALOGUE_OBJECTS).toEqual(["steps", "sales-paths", "channels", "pipes", "sales-funnels"]);
    expect(isCatalogueObject("workflows")).toBe(false);
  });
});

describe("staff only", () => {
  it("both routes sit behind <StaffOnly>", () => {
    for (const p of ["src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/catalogue/[object]/page.tsx", "src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/catalogue/[object]/[id]/page.tsx"]) {
      expect(read(p)).toMatch(/<StaffOnly>\s*<Catalogue(Overview|Object)Page/);
    }
  });
  it("the sidebar mounts the sections (and their reads) in staff mode only", () => {
    expect(read("src/components/v2/v2-shell.tsx")).toContain("{staffMode && <StaffObjectSections");
  });
  it("data comes from the gateway's staff-gated route, never persisted to disk", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain("list: (object: CatalogueReadObject) => `/catalogue/${object}`");
    expect(SENSITIVE_QUERY_ROOTS.has("staffCatalogueList")).toBe(true);
    expect(SENSITIVE_QUERY_ROOTS.has("staffCatalogueObject")).toBe(true);
  });
  it("figures are rendered as served: no arithmetic on cost or ROI in the pages", () => {
    const pages = read("src/components/v2/staff-catalogue-pages.tsx");
    expect(pages).not.toMatch(/costUsd\s*[/*+-]/);
    expect(pages).not.toMatch(/roi\s*[/*+-]\s*\d/);
    expect(pages).toContain("roiIsGood(v)");
  });
});

describe("staff Campaigns section (owner 2026-10-10): sales funnel campaigns with their staff detail", () => {
  it("parses campaign-service's funnel campaign and billing's caps as served", async () => {
    const { SalesFunnelCampaignListSchema, SalesFunnelCapsSchema, centsToUsd, isOngoingFunnelCampaign, producerWord } = await import("../src/lib/sales-funnel-campaigns");
    const list = SalesFunnelCampaignListSchema.parse({
      salesFunnelCampaigns: [
        {
          id: "a5a5f05c-17f2-458a-a886-e620f5dff10d", orgId: "o", brandId: "b", offerId: "f", createdByUserId: null,
          salesFunnelId: "lead_found_to_website_visit@sales-cold-email-outreach+website_visit_to_purchase+purchase_to_paid_client",
          salesFunnelName: "Lumen", status: "stopped", stopReason: "manual", createdAt: "2026-10-10T10:37:24Z", updatedAt: "2026-10-10T10:40:00Z",
          units: [{ campaignId: "c1", pipeId: "sales-cold-email-outreach|lead_found_to_website_visit", featureSlug: "sales-cold-email-outreach", legKey: "lead_found_to_website_visit", status: "stopped", workflowSlug: null, name: "Lumen" }],
        },
      ],
    });
    expect(isOngoingFunnelCampaign(list.salesFunnelCampaigns[0])).toBe(false);
    expect(producerWord("manual")).toBe("Manual");
    const caps = SalesFunnelCapsSchema.parse({
      orgId: "o", brandId: "b", offerId: "f", salesFunnelId: "x", stated: true, updatedAt: null, salesFunnelName: "Lumen", pipes: null, sources: null,
      maxBudget: { amountCents: "10000", period: "daily", periodStart: "2026-10-10T00:00:00Z", periodEnd: null, consumedCents: null, remainingCents: null, reached: null, consumedUnavailableReason: "runs_service_unavailable", consumedUnavailableDetail: "x" },
      maxVolume: null,
    });
    expect(centsToUsd(caps.maxBudget!.amountCents)).toBe(100);
    expect(centsToUsd(caps.maxBudget!.consumedCents)).toBeNull();
  });
  it("the section is the last staff section: Overview, then each ONGOING funnel campaign with its face", () => {
    const shell = read("src/components/v2/v2-shell.tsx");
    const sections = shell.slice(shell.indexOf("function StaffObjectSections("));
    const at = sections.indexOf('<Group title="Campaigns">');
    expect(at).toBeGreaterThan(sections.indexOf('<Group title="Workflows">'));
    expect(sections.slice(at)).toContain('v2CatalogueHref(orgId, brandId, "campaigns")');
    expect(sections.slice(at)).toContain("ongoing.campaigns.map(({ campaign, face })");
  });
  it("its pages sit behind <StaffOnly> and show the staff-only detail (units, workflow picked, funnel id, caps, stop reason)", () => {
    const base = "src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/catalogue/[object]";
    expect(read(`${base}/page.tsx`)).toMatch(/<StaffOnly>\s*<StaffCampaignsOverviewPage \/>/);
    expect(read(`${base}/[id]/page.tsx`)).toMatch(/<StaffOnly>\s*<StaffFunnelCampaignPage/);
    const page = read("src/components/v2/staff-campaign-pages.tsx");
    for (const s of [">Workflow picked<", 'label="Funnel id"', ">Caps read<", 'label="Stop reason"', ">Units<"]) expect(page).toContain(s);
    // Reuse: a unit opens the GA page of the funnel campaign it belongs to (#5293), never a staff copy of it.
    expect(page).toContain("v2CampaignHref(orgId, brandId, funnelCampaignId)");
    expect(page).toContain("funnelCampaignId={c.id}");
  });
});

describe("catalogue icons: Phosphor names only (features-service v0.179.116)", () => {
  it("no other set's spelling is mapped any more", () => {
    const mark = read("src/components/v2/catalogue-mark.tsx");
    const map = mark.slice(mark.indexOf("const CATALOGUE_ICONS"), mark.indexOf("const warned"));
    for (const k of ['  mail:', '"share-2"', "  mic:", '"message-square"', "  linkedin:", '"help-circle"', "  search:"]) expect(map).not.toContain(k);
    expect(map).toContain("envelope: EnvelopeIcon");
  });
});
