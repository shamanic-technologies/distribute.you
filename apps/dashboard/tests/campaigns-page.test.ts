import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Campaigns page (v2, campaign-centered) — a staff/god-mode PREVIEW that
 * re-introduces the campaign concept. Guards the load-bearing invariants:
 *  - gated on the STAFF allowlist (isAdmin), both the nav entry and the page body;
 *  - every displayed stat is a READY features-service field (pipeline / $CAC / ROI
 *    / %CAC) — the page renders, never computes a cost metric client-side
 *    (CLAUDE.md: a displayed stat is features-service-owned);
 *  - reveal-on-settle so a failed gate query can't eternal-skeleton.
 */
describe("Campaigns page (staff-gated v2 preview)", () => {
  const page = read("components/campaigns/campaigns-page.tsx");
  const sidebar = read("components/context-sidebar.tsx");
  const api = read("lib/api.ts");
  const hook = read("lib/use-admin-user.ts");

  it("has a staff (god-mode) gate hook backed by isAdminEmail", () => {
    expect(hook).toContain("isAdminEmail");
    expect(hook).toContain("export function useIsAdminUser");
  });

  it("sidebar gates the Campaigns entry on isAdmin + carries a beta badge", () => {
    expect(sidebar).toContain("useIsAdminUser");
    expect(sidebar).toContain("const isAdmin = useIsAdminUser()");
    expect(sidebar).toContain("campaignsOk");
    // The nav entry + its beta badge.
    expect(sidebar).toContain('id: "campaigns"');
    expect(sidebar).toContain("/campaigns`");
  });

  // The surface is called Campaigns everywhere it is named: nav entry, page
  // heading, empty state, the back-link out of a campaign, and the URL.
  it("names the surface Campaigns, never Channels", () => {
    expect(sidebar).toContain('label: "Campaigns"');
    expect(sidebar).toContain('backLabel="Campaigns"');
    expect(sidebar).not.toContain('label: "Channels"');
    expect(page).toContain(">Campaigns</h1>");
    expect(page).toContain("No campaigns yet.");
    expect(page).not.toContain("No channels yet.");
  });

  // A campaign is set up with us, not spun up from a table row. The create
  // control and the modal behind it are gone, not hidden.
  it("offers no create control", () => {
    expect(page).not.toContain("New channel");
    expect(page).not.toContain("New campaign<");
    expect(page).not.toContain("NewCampaignModal");
    expect(
      fs.existsSync(path.join(SRC, "components/campaigns/new-campaign-modal.tsx")),
    ).toBe(false);
  });

  // The Channel and Goal columns say what brand Settings says: the channel's own
  // mark + catalogue name, and the funnel's mark + name. A second wording for
  // either would be the same thing under two names on two screens.
  it("draws Channel and Goal from the brand-Settings catalogues", () => {
    expect(page).toContain("acquisitionChannelForWorkflowSlug");
    expect(page).toContain("primaryFunnelForGoal");
    expect(page).toContain("<AcquisitionChannelMark");
    expect(page).toContain("<SalesFunnelMark");
    expect(page).toContain("<ChannelCell workflowSlug={campaign.workflowSlug} />");
    expect(page).toContain("<GoalCell goal={goalFor(campaign)} />");
  });

  it("page body gates on isAdmin (staff-only preview)", () => {
    expect(page).toContain("useIsAdminUser");
    expect(page).toContain("if (!isAdmin)");
    expect(page).toContain("Not available");
  });

  it("reads per-campaign stats from the features-service grouped reader", () => {
    expect(page).toContain("getFeatureRevenueByCampaign");
    expect(api).toContain("export async function getFeatureRevenueByCampaign");
    expect(api).toContain("groupBy: \"campaignId\"");
  });

  // Return leads, because that is what the table is sorted by. A table that
  // displays one order and ranks by another reads as unordered.
  it("orders the columns ROI, % CAC, Revenue, Channel, Goal, Status", () => {
    const head = page.slice(page.indexOf("<thead>"), page.indexOf("</thead>"));
    const order = ["ROI", "% CAC", "Revenue", "Channel", "Goal", "Status"];
    let at = -1;
    for (const label of order) {
      const next = head.indexOf(`${label}"`) >= 0 ? head.indexOf(`${label}"`) : head.indexOf(label);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
    // The per-campaign $ CAC column is gone; the brand-level tile still heads
    // the page.
    expect(head).not.toContain("$ CAC");
    expect(page).toContain("Cost per acquisition");
  });

  it("sorts by ROI descending, and the #1 tile reads that same ranking", () => {
    expect(page).toContain("(b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1)");
    expect(page).toContain("rows.find((r) => r.revenue?.roiMultiple != null)");
  });

  // Every number on the row is a projection built from the brand's own rates, so
  // each column says so through the shared (i) primitive — never a native
  // `title` (dead on a phone) and never a second wording per column.
  it("explains each number column through InfoTooltip", () => {
    expect(page).toContain("InfoTooltip");
    expect(page).not.toContain("title=");
    expect(page).toContain("COLUMN_INFO.roi");
    expect(page).toContain("COLUMN_INFO.cacPct");
    expect(page).toContain("COLUMN_INFO.revenue");
    // The revenue column is expected pipeline, not money collected — the whole
    // reason it carries a tip.
    expect(page).toContain("Expected pipeline revenue:");
    expect(page).toContain("not money already collected");
  });

  it("renders all four campaign stats from server fields, no client cost math", () => {
    // Fields come straight off the features-service group.
    expect(page).toContain("totalPipelineUsd");
    expect(page).toContain("costPerConversionUsd");
    expect(page).toContain("roiMultiple");
    expect(page).toContain("costOfAcquisitionPct");
    // No client-side cost derivation (the CPC-incident rule): no dividing a cost
    // by a count, no reduce-summing a cost breakdown.
    expect(page).not.toMatch(/actualCostUsd\s*\/\s*/);
    expect(page).not.toMatch(/\.reduce\(/);
  });

  it("global header blended pipeline + CAC read the brand-level revenue field, not a client sum", () => {
    expect(page).toContain("brandRevenueQ.data?.totalPipelineUsd");
    expect(page).toContain("brandRevenueQ.data?.costEconomics.costPerConversionUsd");
  });

  // The sidebar carries no campaign name and several sit under one brand, so
  // the top bar names the one you drilled into. Tenant identity stays in the
  // switcher — this is page context, on campaign routes only.
  it("names the open campaign in the top bar", () => {
    const header = read("components/header.tsx");
    const context = read("components/header-page-context.tsx");
    expect(header).toContain("<HeaderPageContext />");
    expect(context).toContain('parts[4] !== "campaigns"');
    expect(context).toContain("data?.campaign?.name");
    // Byte-equal to the campaign overview's key → one deduped poll.
    expect(context).toContain('["campaign", campaignId ?? "none"]');
    // A placeholder word would state a name we do not have yet.
    expect(context).not.toContain('|| "Campaign"');
  });

  it("reveals on settle (resolved OR errored) so a failed query can't eternal-skeleton", () => {
    expect(page).toContain("brandRevenueQ.isError");
    expect(page).toContain("campaignsQ.isError");
    expect(page).toContain("groupsQ.isError");
    expect(page).toContain("headerSettled");
    expect(page).toContain("tableSettled");
  });
});
