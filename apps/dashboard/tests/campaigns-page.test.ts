import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Campaigns page (v2, campaign-centered) — GA. Guards the load-bearing invariants:
 *  - NO staff gate and NO beta badge anywhere on the surface: the entry is shown to
 *    every customer on a revenue feature, and the page body renders for them;
 *  - every displayed stat is a READY features-service field (pipeline / $CAC / ROI
 *    / %CAC) — the page renders, never computes a cost metric client-side
 *    (CLAUDE.md: a displayed stat is features-service-owned);
 *  - reveal-on-settle so a failed gate query can't eternal-skeleton.
 */
describe("Campaigns page (GA)", () => {
  const page = read("components/campaigns/campaigns-page.tsx");
  const sidebar = read("components/context-sidebar.tsx");
  const overview = read("components/campaigns/campaign-overview-page.tsx");
  const api = read("lib/api.ts");

  // The surface is GA: the staff-allowlist gate that made it a preview is gone
  // from the nav entry AND from both page bodies. `useIsAdminUser` still exists
  // for the god-mode org switcher — it must simply not gate Campaigns.
  it("carries no staff gate on the sidebar entry or either page body", () => {
    expect(sidebar).not.toContain("useIsAdminUser");
    expect(page).not.toContain("useIsAdminUser");
    expect(page).not.toContain("if (!isAdmin)");
    expect(page).not.toContain("Not available");
    expect(overview).not.toContain("useIsAdminUser");
    expect(overview).not.toContain("if (!isAdmin)");
    expect(overview).not.toContain("staff-only");
  });

  it("shows the Campaigns entry on every revenue feature, with no beta badge", () => {
    expect(sidebar).toContain("const campaignsOk = isRevenueFeature(featureSlug)");
    expect(sidebar).toContain('id: "campaigns"');
    expect(sidebar).toContain("/campaigns`");
    expect(page).not.toContain("MaturityBadge");
    // The campaign-level nav rows (Overview / Leads / Strategy / Audiences) drop
    // their badges too — a GA surface states no maturity.
    const campaignSidebar = sidebar.slice(sidebar.indexOf("function CampaignLevelSidebar("));
    expect(campaignSidebar).not.toContain('maturity: "beta"');
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

  // The Channel and Sales funnel columns say what brand Settings says: the
  // channel's own mark + catalogue name, and the funnel's mark + name. A second
  // wording for either would be the same thing under two names on two screens.
  it("draws Channel and Sales funnel from the brand-Settings catalogues", () => {
    expect(page).toContain("acquisitionChannelForWorkflowSlug");
    expect(page).toContain("<AcquisitionChannelMark");
    expect(page).toContain("<SalesFunnelMark");
    expect(page).toContain("<ChannelCell workflowSlug={campaign.workflowSlug} />");
    expect(page).toContain(
      "<FunnelCell funnelKey={campaign.funnelKey} />",
    );
  });

  // The funnel column reads the campaign's OWN key and NOTHING else. The goal is
  // the retired, lossier vocabulary — two funnels answer to `meetingBooked` — so
  // deriving a funnel from it prints a chain the campaign never stated.
  // campaign-service persists the funnel on every campaign, so a missing one is
  // a real gap and reads as one.
  it("names the funnel from the campaign's own key, with no goal fallback", () => {
    // `\n}\n` and not `\n}`: the props are destructured with a type annotation,
    // so the first `\n}` in this component closes the parameter block, not the
    // function — slicing there cuts the body out entirely.
    const cell = page.slice(page.indexOf("function FunnelCell("));
    const body = cell.slice(0, cell.indexOf("\n}\n"));
    expect(body).toContain("campaignFunnel(funnelKey)");
    expect(body).not.toContain("primaryFunnelForGoal");
    expect(body).toContain('def ? def.name : "—"');
    expect(api).toContain("funnelKey: SalesFunnelKeyWire | null;");
  });

  // A campaign a brand has been running keeps running when that brand funds its
  // funnels — campaign-service adopts it into that funnel rather than parking it
  // and provisioning an empty twin. So the page invents no state: it renders the
  // campaign's own status, and there is no "superseded" anywhere in the fleet.
  it("renders the campaign's own status and invents no state", () => {
    expect(page).toContain("<StatusPill status={campaign.status} />");
    expect(page).not.toContain("superseded");
    expect(page).not.toContain("Superseded");
    // The table is the campaigns a brand RUNS — one line per live campaign. A
    // stopped campaign is history, not a line; its runs still count because
    // features-service totals each identity (org, brand, funnel, channel)
    // server-side, so the live campaign's figures include its stopped ancestors.
    expect(page).toContain("featureCampaigns.filter((c) => isActiveStatus(c.status))");
  });

  it("reads per-campaign stats from the features-service grouped reader", () => {
    expect(page).toContain("getFeatureRevenueByCampaign");
    expect(api).toContain("export async function getFeatureRevenueByCampaign");
    expect(api).toContain("groupBy: \"campaignId\"");
  });

  // Return leads, because that is what the table is sorted by. A table that
  // displays one order and ranks by another reads as unordered.
  it("orders the columns ROI, % CAC, Revenue, Sales funnel, Channel, Status", () => {
    const head = page.slice(page.indexOf("<thead>"), page.indexOf("</thead>"));
    const order = ["ROI", "% CAC", "Revenue", "Sales funnel", "Channel", "Status"];
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

  // Type + chrome come from the dashboard's own tables and cards, not from this
  // page's taste. A heavier header or a different eyebrow reads as a different
  // product sitting inside the same shell.
  it("uses the dashboard's table header and card eyebrow, not its own", () => {
    const leads = read("components/audiences/engaged-leads-page.tsx");
    const header =
      "border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";
    expect(leads).toContain(header);
    expect(page).toContain(header);
    // Row separation via the same divider the reference table uses, so a row
    // carries no border of its own.
    expect(page).toContain('<tbody className="divide-y divide-gray-50">');
    expect(page).not.toContain("border-b border-gray-100 cursor-pointer");
    // The eyebrow on a stat card, byte-equal to top-audiences-card's.
    const eyebrow = "text-xs font-medium text-gray-400 uppercase tracking-wide";
    expect(read("components/revenue/top-audiences-card.tsx")).toContain(eyebrow);
    expect(page).toContain(eyebrow);
  });

  // ROI is the row's headline number, and a return above 1x is the campaign
  // making money back. Below 1x stays the ordinary colour: an early campaign is
  // under 1x by construction, and red would call it a failure. Weight and colour
  // carry the emphasis — a second type size inside one row is what made the
  // table read as its own thing.
  it("greens ROI above 1x, never red below, at the table's own size", () => {
    const cell = page.slice(page.indexOf("function RoiCell("));
    const body = cell.slice(0, cell.indexOf("\n}"));
    expect(body).toContain("multiple != null && multiple > 1");
    expect(body).toContain("font-semibold");
    expect(body).toContain("text-green-600");
    expect(body).toContain("text-gray-900");
    expect(body).not.toContain("text-red");
    expect(body).not.toMatch(/text-(base|lg|xl)/);
  });

  // Every row is a live campaign by construction (the table filters to them
  // before ranking), so ROI desc is the whole sort — the column the table leads
  // with. The #1 tile reads that same ordering off `rows`, so it can never name a
  // campaign other than the first row.
  it("sorts live campaigns by ROI descending, and the #1 tile reads that same ranking", () => {
    expect(page).toContain("featureCampaigns.filter((c) => isActiveStatus(c.status))");
    expect(page).toContain("(b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1)");
    expect(page).not.toContain("if (byStatus !== 0) return byStatus;");
    expect(page).toContain("rows.find((r) => r.revenue?.roiMultiple != null)");
  });

  // `listCampaignsByBrand` answers for the WHOLE brand, so it also returns the PR,
  // AI-visibility and VC campaigns — products that run no sales funnel and whose
  // figures this page never fetched (`getFeatureRevenueByCampaign` is scoped to
  // `featureSlug`). Listing one population while pricing another is the bug; the
  // clutter was only how it showed. The empty state reads the same scoped set, or a
  // brand whose only campaigns belong to another feature would be told it has some.
  it("lists only the campaigns of the feature whose figures it renders", () => {
    expect(page).toContain("campaigns.filter((c) => c.featureSlug === featureSlug)");
    expect(page).toContain('featureCampaigns.length === 0 ? "No campaigns yet." : "No active campaigns."');
    expect(page).not.toContain('campaigns.length === 0 ? "No campaigns yet."');
  });

  // The words that paint a pill green and the words that rank a row first are ONE
  // set. Two lists would let the colour and the order disagree about which
  // campaigns are live — a row shown as running, sorted as stopped.
  it("ranks on the same status set the pill paints green", () => {
    expect(page).toContain('const ACTIVE_STATUSES = new Set(["active", "running", "ongoing", "live"])');
    const pill = page.slice(page.indexOf("function StatusPill("));
    expect(pill.slice(0, pill.indexOf("\n}"))).toContain("isActiveStatus(status)");
  });

  // A running campaign reads "Active" — the same word the brand status pill uses for
  // the same idea. `ongoing` is campaign-service's internal spelling; printing it put
  // two words for one concept on screen. Only the LABEL is translated: the pill still
  // renders `campaign.status` and `isActiveStatus` still decides what running means.
  it("says Active, never the wire's own word for it", () => {
    const label = page.slice(page.indexOf("function statusLabel("));
    const body = label.slice(0, label.indexOf("\n}"));
    expect(body).toContain('isActiveStatus(status) ? "Active" : status');
    const pill = page.slice(page.indexOf("function StatusPill("));
    expect(pill.slice(0, pill.indexOf("\n}"))).toContain("{statusLabel(status)}");
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
    // The campaign is named as what it IS (funnel x channel), never by
    // campaign-service's stored name, which predates the per-funnel model.
    expect(context).toContain("<CampaignTitle");
    expect(context).not.toContain("campaign?.name");
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
