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
  // The table, its columns and the vocabulary behind them are a COMPONENT — the brand
  // Overview renders the same one under its chart. So the assertions about columns,
  // cells, ordering and status wording read the table; the ones about the page's own
  // header (tiles, heading, #1 channel) still read the page.
  const table = read("components/campaigns/campaigns-table.tsx");
  const identity = read("components/campaigns/campaign-identity.tsx");
  const modal = read("components/campaigns/campaign-controls-modal.tsx");
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
  // heading, empty state, and the URL.
  it("names the surface Campaigns, never Channels", () => {
    expect(sidebar).toContain('label: "Campaigns"');
    expect(sidebar).not.toContain('label: "Channels"');
    expect(page).toContain(">Campaigns</h1>");
    expect(table).toContain("No campaigns yet.");
    expect(table).not.toContain("No channels yet.");
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
    // The channel is READ off the campaign's own feature slug, never inferred
    // from the workflow: a channel IS a feature slug, and two cold-email
    // channels differ only by their offer, so a workflow guess cannot tell them
    // apart and never could.
    expect(table).toContain("acquisitionChannelForFeatureSlug");
    expect(table).not.toContain("acquisitionChannelForWorkflowSlug");
    expect(identity).toContain("<AcquisitionChannelMark");
    expect(identity).toContain("<SalesFunnelMark");
    // ONE cell states the pair: a campaign IS (offer x funnel x channel), so the
    // funnel and the channel were never two independent answers — only two
    // columns. The row reads them from the campaign it is given, once.
    expect(table).toContain("<CampaignCell campaign={campaign} />");
    expect(table).toContain("campaignFunnel(campaign.funnelKey)");
    expect(identity).toContain("acquisitionChannelForFeatureSlug(featureSlug, channels)");
    // The layout lives in one module, because the budget modal states the same
    // pair for the same campaigns and a second copy is how the row and the modal
    // that funds it come to describe one campaign two ways.
    expect(table).toContain("<CampaignIdentity");
    expect(modal).toContain("<CampaignIdentity");
    expect(modal).not.toContain("FunnelCell");
    expect(modal).not.toContain("ChannelCell");
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
    const cell = table.slice(table.indexOf("export function CampaignCell("));
    const body = cell.slice(0, cell.indexOf("\n}\n"));
    expect(body).toContain("campaignFunnel(campaign.funnelKey)");
    expect(body).not.toContain("primaryFunnelForGoal");
    // A funnel we cannot resolve is a real gap and reads as one.
    expect(identity).toContain('funnel ? funnel.name : "—"');
    expect(api).toContain("funnelKey: SalesFunnelKeyWire | null;");
  });

  // A campaign a brand has been running keeps running when that brand funds its
  // funnels — campaign-service adopts it into that funnel rather than parking it
  // and provisioning an empty twin. So the page invents no state: it renders the
  // campaign's own status, and there is no "superseded" anywhere in the fleet.
  it("renders the campaign's own status and invents no state", () => {
    expect(table).toContain("<StatusPill status={campaign.status} />");
    expect(page).not.toContain("superseded");
    expect(page).not.toContain("Superseded");
  });

  // ONE LINE PER IDENTITY — (offer x funnel x channel) — running or paused.
  //
  // campaign-service keeps every superseded row (it used to mint a fresh one on each
  // workflow switch), so the stored rows are many where the campaign is one: the
  // brand that surfaced this carries 1 ongoing, 1 manually paused, and 45 `stopped`
  // ancestors of the ongoing one. The old active-only filter was right about the 45
  // and wrong about the 1 — it hid the campaign the customer paused, which is the one
  // they most want to see and turn back on. Collapsing on the identity keeps both:
  // the ancestors ride on their live row (features-service totals the identity
  // server-side, so the money is already theirs), and an identity with no live row
  // states its latest, which IS the paused campaign.
  it("states one row per identity — the live campaign, else the latest paused one", () => {
    expect(table).toContain("const listedCampaigns = useMemo(");
    expect(table).toContain(
      "const key = `${c.offerId ?? \"\"}|${c.funnelKey ?? \"\"}|${c.featureSlug ?? \"\"}`",
    );
    // A live row wins its identity outright; between two dead ones, the latest.
    expect(table).toContain("if (isActiveStatus(held.status)) continue;");
    expect(table).toContain(
      "if (isActiveStatus(c.status) || c.updatedAt > held.updatedAt) byIdentity.set(key, c);",
    );
    // The status filter is GONE: a paused campaign is a row.
    expect(table).not.toContain("featureCampaigns.filter((c) => isActiveStatus(c.status))");
  });

  it("reads per-campaign stats from the features-service grouped reader", () => {
    expect(table).toContain("getFeatureRevenueByCampaign");
    expect(api).toContain("export async function getFeatureRevenueByCampaign");
    expect(api).toContain("groupBy: \"campaignId\"");
  });

  // Identity leads: which campaign this is, stated once as the funnel it sells
  // with the channel under it. The return follows, and the table is sorted by it.
  // `$ Invested` sits immediately right of `$ Revenue`: the money block reads
  // projection, projection, projection, then the one realized figure behind them.
  // `$ Budget` sits with the STATUS, not with the money block: those four are
  // charges and projections of charges, and a ceiling is neither. Beside the
  // pill it answers the other half of one question — is this campaign running,
  // and how hard.
  it("orders the columns Campaign, ROI, % CAC, $ Revenue, $ Invested, $ Budget, Status", () => {
    const head = table.slice(table.indexOf("<thead>"), table.indexOf("</thead>"));
    const order = [
      "Campaign",
      "ROI",
      "% CAC",
      "$ Revenue",
      "$ Invested",
      "$ Budget",
      "Status",
    ];
    let at = -1;
    for (const label of order) {
      const next = head.indexOf(`${label}"`) >= 0 ? head.indexOf(`${label}"`) : head.indexOf(label);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
    // The per-campaign $ CAC column is gone; the brand-level tile still heads
    // the page.
    // The two columns this one replaces do not come back: printing the funnel and
    // the channel apart is one identity stated in two places.
    expect(head).not.toContain("Sales funnel");
    expect(head).not.toContain(">Channel<");
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
    expect(table).toContain(header);
    // Row separation via the same divider the reference table uses, so a row
    // carries no border of its own.
    expect(table).toContain('<tbody className="divide-y divide-gray-50">');
    expect(table).not.toContain("border-b border-gray-100 cursor-pointer");
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
    const cell = table.slice(table.indexOf("function RoiCell("));
    const body = cell.slice(0, cell.indexOf("\n}"));
    expect(body).toContain("multiple != null && multiple > 1");
    expect(body).toContain("font-semibold");
    expect(body).toContain("text-green-600");
    expect(body).toContain("text-gray-900");
    expect(body).not.toContain("text-red");
    expect(body).not.toMatch(/text-(base|lg|xl)/);
  });

  // STATUS, then ROI DESC, then last-updated DESC — in that order.
  //
  // Status leads now that the list holds both: what is running goes above what is
  // not, so a paused campaign never sits between two live ones on the strength of a
  // return it is no longer earning. Within a status it is the ROI column the table
  // leads with, and last-updated breaks the tie between the rows with no figures at
  // all — the only thing left that distinguishes them.
  it("sorts by status, then ROI descending, then last updated", () => {
    const sort = table.slice(table.indexOf("return joined.sort((a, b) => {"));
    const body = sort.slice(0, sort.indexOf("\n  }, ["));
    expect(body).toContain(
      "Number(isActiveStatus(b.campaign.status)) - Number(isActiveStatus(a.campaign.status))",
    );
    expect(body).toContain("if (byStatus !== 0) return byStatus;");
    expect(body).toContain("(b.revenue?.roiMultiple ?? -1) - (a.revenue?.roiMultiple ?? -1)");
    expect(body).toContain("if (byRoi !== 0) return byRoi;");
    expect(body).toContain("b.campaign.updatedAt.localeCompare(a.campaign.updatedAt)");
    // Status is compared before ROI, and ROI before the date.
    expect(body.indexOf("byStatus")).toBeLessThan(body.indexOf("byRoi"));
    expect(body.indexOf("byRoi")).toBeLessThan(body.indexOf("updatedAt"));
  });

  // The surfaces whose question is about LIVE campaigns read `activeRows`, derived
  // from the same ordered `rows` rather than from a second filter — one identity
  // collapse and one ordering, so the two lists cannot disagree about which campaign
  // is first. Naming a channel or offering a funnel tab off a campaign that stopped
  // months ago describes something the brand no longer sells.
  it("keeps the #1 tile and the brand-level Leads tabs on the RUNNING rows", () => {
    expect(table).toContain("const activeRows = useMemo(");
    expect(table).toContain("rows.filter((r) => isActiveStatus(r.campaign.status))");
    expect(table).toContain("return { rows, activeRows, settled };");
    expect(page).toContain("activeRows.find((r) => r.revenue?.roiMultiple != null)");
    expect(page).not.toContain("rows.find((r) => r.revenue?.roiMultiple != null)");
    // Leads: brand level reads the running rows; a campaign's own page reads its
    // own row whatever its status, so a paused campaign still states its funnel.
    const leads = read("components/audiences/engaged-leads-page.tsx");
    expect(leads).toContain(": campaignRows.activeRows;");
    expect(leads).toContain("campaignRows.rows.filter((r) => r.campaign.id === campaignId)");
  });

  // `listCampaignsByBrand` answers for the WHOLE brand, so it also returns the PR,
  // AI-visibility and VC campaigns — products that run no sales funnel and whose
  // figures this page never fetched (`getFeatureRevenueByCampaign` is scoped to
  // `featureSlug`). Listing one population while pricing another is the bug; the
  // clutter was only how it showed. The empty state reads the same scoped set, or a
  // brand whose only campaigns belong to another feature would be told it has some.
  it("lists only the campaigns of the feature whose figures it renders", () => {
    expect(table).toContain("c.featureSlug === featureSlug");
    // ONE empty sentence: every campaign belongs to an identity and every identity
    // states a row, so the list is empty exactly when the brand has no campaign on
    // this feature. "No active campaigns." named a state it can no longer be in.
    expect(table).toContain("No campaigns yet.");
    expect(table).not.toContain("No active campaigns.");
  });

  // The words that paint a pill green and the words that rank a row first are ONE
  // set. Two lists would let the colour and the order disagree about which
  // campaigns are live — a row shown as running, sorted as stopped.
  it("ranks on the same status set the pill paints green", () => {
    expect(table).toContain('const ACTIVE_STATUSES = new Set(["active", "running", "ongoing", "live"])');
    const pill = table.slice(table.indexOf("function StatusPill("));
    expect(pill.slice(0, pill.indexOf("\n}"))).toContain("isActiveStatus(status)");
  });

  // A campaign reads "Active" or "Paused" — never `ongoing` / `stopped`, which are
  // campaign-service's internal spellings and put two words for one concept on
  // screen. `stopped` reads Paused specifically because the controls modal stops and
  // restarts a campaign through that same status while leaving its ceiling alone, so
  // a stopped campaign is one waiting to be turned back on; it also keeps this pill
  // and the modal's roll-up saying the same word about the same campaign. Only the
  // LABEL is translated: the pill still renders `campaign.status` and `isActiveStatus`
  // still decides what running means.
  it("says Active and Paused, never the wire's own words for them", () => {
    const label = table.slice(table.indexOf("function statusLabel("));
    const body = label.slice(0, label.indexOf("\n}"));
    expect(body).toContain('if (isActiveStatus(status)) return "Active"');
    expect(body).toContain('status.toLowerCase() === "stopped" ? "Paused" : status');
    const pill = table.slice(table.indexOf("function StatusPill("));
    expect(pill.slice(0, pill.indexOf("\n}"))).toContain("{statusLabel(status)}");
  });

  // One vocabulary across the two surfaces that name a campaign's state: the table's
  // pill and the controls modal's roll-up. A row reading "stopped" in the list beside
  // a "Paused" pill on that campaign's own page is one campaign described two ways.
  it("shares its running/paused words with the controls roll-up", () => {
    const lib = read("lib/campaign-controls.ts");
    expect(lib).toContain('active: "Active"');
    expect(lib).toContain('paused: "Paused"');
  });

  // Every number on the row is a projection built from the brand's own rates, so
  // each column says so through the shared (i) primitive — never a native
  // `title` (dead on a phone) and never a second wording per column.
  it("explains each number column through InfoTooltip", () => {
    expect(table).toContain("InfoTooltip");
    expect(table).not.toContain("title=");
    expect(table).toContain("COLUMN_INFO.roi");
    expect(table).toContain("COLUMN_INFO.cacPct");
    expect(table).toContain("COLUMN_INFO.revenue");
    expect(table).toContain("COLUMN_INFO.invested");
    // The revenue column is expected pipeline, not money collected — the whole
    // reason it carries a tip.
    expect(table).toContain("Expected pipeline revenue:");
    expect(table).toContain("not money already collected");
    // `$ Invested` is the one already-happened figure beside three projections, so
    // its tip says so rather than leaving a reader to multiply it by the ROI next to
    // it — and it names BOTH halves of the committed basis, since a reader who reads
    // "cost" as billed-only will not understand why it exceeds what they were charged.
    expect(table).toContain("money already billed plus money reserved for emails it has queued");
    expect(table).toContain("not a multiplier of them");
  });

  it("renders all four campaign stats from server fields, no client cost math", () => {
    // Fields come straight off the features-service group.
    expect(table).toContain("totalPipelineUsd");
    expect(table).toContain("roiMultiple");
    expect(table).toContain("costOfAcquisitionPct");
    // `$ Invested` renders the served COMMITTED net spend verbatim — the same field
    // ROI and % CAC divide by, so a row cannot contradict its own return.
    expect(table).toContain("fmtUsd(revenue?.committedCostUsd)");
    // No client-side cost derivation (the CPC-incident rule): no dividing a cost
    // by a count, no reduce-summing a cost breakdown.
    expect(table).not.toMatch(/committedCostUsd\s*\/\s*/);
    expect(table).not.toMatch(/\.reduce\(/);
  });

  // A row states what its campaign may spend in a day beside whether it is
  // running — the ceiling and the status are one answer in two cells.
  it("states each campaign's own daily ceiling, narrowed by the ROW's own offer", () => {
    // billing's per-pair figure spans every offer selling that pair, so a row
    // that borrowed the pair total would print a sibling offer's money under
    // this campaign's name. Reading the row's own offer is what makes the
    // brand-scoped list and the offer-scoped one agree about one campaign.
    expect(table).toContain("campaignBudgetCents(c, c.offerId ?? undefined, budgets, channels)");
    expect(table).toContain("fmtDailyBudgetUsd(budgetCents)");
    // Stated as a RATE, in the campaign header's own words and style: a bare
    // figure reads as a total beside the two money columns to its left, which
    // really are totals. Withheld on the dash — "we have no figure" is not a
    // figure per day.
    expect(table).toContain('<span className="text-gray-400"> / day</span>');
    expect(table).toContain("budgetCents == null ? (");
    // The shared narrowing, so the table, the campaign Overview and Campaign
    // Settings cannot disagree about one campaign's money.
    expect(table).toContain('from "@/lib/campaign-budget"');
    // The key Campaign Settings and Offer Settings already read → no new poll.
    expect(table).toContain('["brandFunnelBudgets", brandId]');
    // A ceiling is not a charge, and the tip says so rather than letting a
    // reader read it as spend beside four columns that are.
    expect(table).toContain("COLUMN_INFO.budget");
    expect(table).toContain("It is a ceiling you set, not money spent");
    // Nothing is derived here: no summing ceilings, no dividing one.
    expect(table).not.toMatch(/budgetCents\s*[/*+]\s*/);
  });

  it("holds the table's own shape as the column count grows", () => {
    // A stale colSpan silently narrows the skeleton and the empty state, and a
    // stale min-w lets the last column fold.
    expect(table).toContain("md:min-w-[760px]");
    expect(table).not.toContain("colSpan={8}");
    expect(table).not.toContain("colSpan={9}");
    expect((table.match(/colSpan=\{7\}/g) ?? []).length).toBe(2);
  });

  /**
   * On a phone the row answers the two questions a reader can act on: which
   * campaign, and what it returns. Everything else folds away rather than
   * scrolling sideways off the screen.
   *
   * "Which campaign" is the funnel and the channel together — a campaign IS
   * (offer x funnel x channel), so naming one without the other names half of it.
   * They are ONE column at every width, so there is no mobile-only copy to keep
   * in step with a desktop one and no width that can show half an identity.
   */
  describe("fits a phone", () => {
    it("gates the width floor at the breakpoint the columns come back", () => {
      // Unconditional, the floor re-widens the row past the viewport even with five
      // columns hidden, pushing the survivors off to the right (the leads-table case).
      expect(table).not.toMatch(/[^:]min-w-\[760px\]/);
      expect(table).toContain("table-fixed");
      expect(table).toContain("md:table-auto");
      // The two survivors split the phone's width and give it back at `md`, where
      // the auto layout sizes every column to its content.
      expect(table).toContain('w-[30%] md:w-auto');
      expect(table).toContain('w-[70%] md:w-auto');
      // No mobile-only cell to drift from a desktop one: there is one identity
      // column, rendered at every width.
      expect(table).not.toContain("md:hidden");
    });

    it("states the funnel above the channel in one cell, pinned to the mark's height", () => {
      const at = identity.indexOf("export function CampaignIdentity(");
      expect(at).toBeGreaterThan(-1);
      const cell = identity.slice(at, identity.indexOf("\n}\n", at));
      const funnelAt = cell.indexOf("<SalesFunnelMark");
      const channelAt = cell.indexOf("<AcquisitionChannelMark");
      expect(funnelAt).toBeGreaterThan(-1);
      expect(channelAt).toBeGreaterThan(funnelAt);
      // The channel line is the quiet one, and it says what it is.
      expect(cell).toContain("text-xs");
      expect(cell).toContain("text-gray-500");
      expect(cell).toContain("Via");
      // Two lines whose leadings add to the funnel tile's own 32px (`sm` = h-8),
      // so the row is the height of the icon rather than of whatever the text
      // needs. 18 on the second because the channel mark there is `xs` (18px).
      expect(cell).toContain("h-8");
      expect(cell).toContain("leading-[14px]");
      expect(cell).toContain("leading-[18px]");
      expect(cell).toContain('size="sm"');
      expect(cell).toContain('size="xs"');
    });

    it("hides every money column below md, and no more", () => {
      for (const label of ["% CAC", "$ Revenue", "$ Invested", "$ Budget"]) {
        const at = table.indexOf(`label="${label}"`);
        expect(at).toBeGreaterThan(-1);
        expect(table.slice(table.lastIndexOf("<th", at), at)).toContain("hidden md:table-cell");
      }
      // Header + cell for each of the five folded columns (the four money ones and
      // Status). Campaign and ROI render at every width.
      expect((table.match(/hidden md:table-cell/g) ?? []).length).toBe(10);
    });
  });

  it("global header blended pipeline + CAC read the brand-level revenue field, not a client sum", () => {
    expect(page).toContain("brandRevenueQ.data?.totalPipelineUsd");
    expect(page).toContain("brandRevenueQ.data?.costEconomics.costPerAcquisitionUsd");
  });

  // The top bar names where you are below the tenant: the offer, and the
  // campaign under it. Tenant identity (org, brand) stays in the switcher.
  //
  // This guard used to pin the campaign at path segment 4 — `parts[4] !==
  // "campaigns"` — which is exactly the assertion that let the bar break in
  // silence when campaigns moved under the offer. It now pins the PARSER by
  // name, so a future level shift fails in one place that has a test on it.
  it("names the open campaign in the top bar", () => {
    const header = read("components/header.tsx");
    const context = read("components/header-page-context.tsx");
    expect(header).toContain("<HeaderPageContext />");
    expect(context).toContain("export function offerRouteFromPath");
    expect(context).toContain('p[4] !== "offers"');
    // The campaign is named as what it IS (funnel x channel), never by
    // campaign-service's stored name, which predates the per-funnel model.
    expect(context).toContain("<CampaignTitle");
    expect(context).not.toContain("campaign?.name");
    // Byte-equal to the campaign overview's key → one deduped poll.
    expect(context).toContain('["campaign", route?.campaignId ?? "none"]');
    // A placeholder word would state a name we do not have yet.
    expect(context).not.toContain('|| "Campaign"');
  });

  it("reveals on settle (resolved OR errored) so a failed query can't eternal-skeleton", () => {
    expect(page).toContain("brandRevenueQ.isError");
    expect(table).toContain("campaignsQ.isError");
    expect(table).toContain("groupsQ.isError");
    // The per-channel fan-out is in the gate too: one channel's read failing must
    // not hold the table, and one still loading must not let it paint half its money.
    expect(table).toContain("channelGroupQs.every");
    expect(page).toContain("headerSettled");
    expect(page).toContain("tableSettled");
  });

  it("lists an offer's campaigns across CHANNELS, not one feature slug", () => {
    // An offer is sold through several acquisition channels at once, each its own
    // campaign. Pinning the offer-scoped list to a single slug showed a customer one
    // of their campaigns and silently dropped the rest — which is exactly what
    // happened the day a second cold-email channel was funded and provisioned.
    //
    // The feature filter's REASON survives: it keeps out the brand's PR,
    // AI-visibility and VC campaigns, which run no sales funnel and can never fill
    // these columns. So the offer-scoped test asks that question directly, off the
    // channel catalogue, which means a THIRD channel needs no edit here.
    expect(table).toContain(
      "acquisitionChannelForFeatureSlug(c.featureSlug, channels) !== null",
    );
    // The brand-scoped list (no offer) stays pinned to its one feature: with no offer
    // to bound it, spanning channels would mix propositions.
    expect(table).toContain("c.featureSlug === featureSlug");
  });

  it("reads each channel's money from its own channel, and never adds channels up", () => {
    // That endpoint prices ONE channel at a time and a campaign is paced and priced
    // on its own channel's money, so the rows are merged by campaign id. A sum here
    // would be a browser-computed metric AND would drift from what billing charges.
    expect(table).toContain("useQueries");
    expect(table).toContain('["featureRevenueByCampaign", brandId, slug]');
    // Merged by campaign id — a campaign IS a channel, so it appears in exactly one
    // channel's answer and the merge can never make two sources disagree on a row.
    expect(table).toContain("m.set(g.campaignId, g)");
    // Measured: 902 chars from the memo that names the channels to the closing brace
    // of the queries call. Do NOT pad — this is a not-toContain guard, so a slice
    // running past the block would read neighbouring code and fail on correct code.
    const fanoutAt = table.indexOf("const channelSlugs = useMemo(");
    const fanout = table.slice(fanoutAt, fanoutAt + 902);
    expect(fanout).not.toContain("reduce");
    expect(fanout).not.toContain("+=");
  });

  it("scopes the campaign DETAIL page to the campaign's own channel", () => {
    // A campaign IS (offer x funnel x channel). Resolving the brand's sole GA
    // feature instead scoped every read to a channel the open campaign may not run
    // on: a campaign on the brand's second channel had its spend fetched for the
    // FIRST one, which does not carry it, so the page read `$0 spent today` for a
    // campaign that had committed $10.32 that day — while the list one click away
    // read it correctly. Two surfaces, one campaign, two numbers, neither erroring.
    const detail = read("components/campaigns/campaign-overview-page.tsx");
    expect(detail).toContain("const featureSlug = campaign?.featureSlug ?? null");
    // The brand's sole-feature resolver must not come back to this page.
    expect(detail).not.toContain("useSoleFeatureSlug");
    // No read may fire under a guessed slug: until the campaign resolves we do not
    // know its channel, and a read fired on the wrong one lands in that channel's
    // cache entry.
    expect(detail).toContain("const enabled = featureSlug !== null && isChannelCampaign");
    // Availability is decided by the campaign's OWN channel, not by which feature is
    // GA for the brand — that is what would blank the page for every campaign but one.
    expect(detail).toContain("!campaignLoading && !isChannelCampaign");
    expect(detail).not.toContain("isRevenueFeature");
  });

  it("carries the org gate explicitly on the fan-out", () => {
    // `useQueries` is not `useAuthQuery`, so the DIS-143 cross-org gate does not come
    // for free. It is asked for rather than re-derived — a second copy of that gate
    // is how one surface keeps the isolation and another quietly loses it.
    expect(table).toContain("useOrgQueryGate");
    expect(table).toContain("enabled: orgConsistent &&");
    const gate = read("lib/use-auth-query.ts");
    expect(gate).toContain("export function useOrgQueryGate");
  });
});
