import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Campaign rows (`useCampaignRows`, read by the v2 missions). Guards the load-bearing invariants:
 *  - every displayed stat is a READY features-service field (pipeline / ROI / %CAC):
 *    the table renders, never computes a cost metric client-side
 *    (CLAUDE.md: a displayed stat is features-service-owned);
 *  - reveal-on-settle so a failed gate query can't eternal-skeleton.
 */
describe("Campaign rows (useCampaignRows)", () => {
  const table = read("components/campaigns/campaigns-table.tsx");
  const identity = read("components/campaigns/campaign-identity.tsx");
  const api = read("lib/api.ts");

  // A campaign is set up with us, not spun up from a table row. The create
  // control and the modal behind it are gone, not hidden.
  it("ships no create modal", () => {
    expect(
      fs.existsSync(path.join(SRC, "components/campaigns/new-campaign-modal.tsx")),
    ).toBe(false);
  });

  // The Channel and Sales funnel columns say what brand Settings says: the
  // channel's own mark + catalogue name, and the funnel's mark + name. A second
  // wording for either would be the same thing under two names on two screens.
  it("draws the leg and the channel from the published catalogues", () => {
    // The channel is READ off the campaign's own feature slug, never inferred
    // from the workflow: a channel IS a feature slug, and two cold-email
    // channels differ only by their offer, so a workflow guess cannot tell them
    // apart and never could.
    expect(table).toContain("acquisitionChannelForFeatureSlug");
    expect(table).not.toContain("acquisitionChannelForWorkflowSlug");
    expect(identity).toContain("<AcquisitionChannelMark");
    expect(identity).toContain("<LegMark");
    expect(identity).not.toContain("<SalesFunnelMark");
    expect(identity).toContain("acquisitionChannelForFeatureSlug(featureSlug, channels)");
  });

  // The funnel column reads the campaign's OWN key and NOTHING else. The goal is
  // the retired, lossier vocabulary — two funnels answer to `meetingBooked` — so
  // deriving a funnel from it prints steps the campaign never stated.
  // campaign-service persists the funnel on every campaign, so a missing one is
  // a real gap and reads as one.
  it("names the leg from the campaign's own key, with no goal fallback", () => {
    // The row is named for the LEG the campaign states, LOOKED UP in the catalogue
    // rather than parsed. A leg we cannot resolve is a real gap and reads as one.
    expect(identity).toContain("return leg ?? legFor(catalogue, legKey);");
    expect(identity).toContain('{leg?.label ?? "—"}');
    expect(api).toContain("legKey: string | null;");
    expect(api).not.toContain("funnelKey: SalesFunnelKeyWire | null;");
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
      "const key = `${c.offerId ?? \"\"}|${c.legKey ?? \"\"}|${c.featureSlug ?? \"\"}`",
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

  // features-service serves `outcomes` REQUIRED and NULLABLE: null is its own word
  // for "no funnel is wired for this channel and the leads were never read", which a
  // brand really hits — an offer sold through a channel that states sales funnels but
  // has no funnel wired (prod: `pr-expert-quote-opportunities`) answers with exactly
  // that. `.optional()` accepts `undefined` and REFUSES `null`, so the whole read threw
  // and every campaign row on the offer went blank over one channel's null.
  it("accepts a group whose outcomes block is null, not only an absent one", () => {
    expect(api).toContain("outcomes: CampaignRevenueOutcomesSchema.nullish()");
    expect(api).not.toContain("outcomes: CampaignRevenueOutcomesSchema.optional()");
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
    // The MATURE return, the half of the served pair the row states (features-service#1196).
    expect(body).toContain("(b.revenue?.economicsMaturity?.mature?.roiMultiple ?? -1)");
    expect(body).toContain("(a.revenue?.economicsMaturity?.mature?.roiMultiple ?? -1)");
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
  });

  // `listCampaignsByBrand` answers for the WHOLE brand, so it also returns the PR,
  // AI-visibility and VC campaigns — products that run no sales funnel and whose
  // figures this page never fetched (`getFeatureRevenueByCampaign` is scoped to
  // `featureSlug`). Listing one population while pricing another is the bug; the
  // clutter was only how it showed. The empty state reads the same scoped set, or a
  // brand whose only campaigns belong to another feature would be told it has some.
  it("lists only the campaigns of the feature whose figures it renders", () => {
    expect(table).toContain("c.featureSlug === featureSlug");
  });

  // The words that decide a row is running are ONE set, read by every consumer
  // (`isActiveStatus`), so two lists cannot disagree about which campaigns are live.
  it("defines running as ONE status set", () => {
    expect(table).toContain('const ACTIVE_STATUSES = new Set(["active", "running", "ongoing", "live"])');
  });

  // One vocabulary across the two surfaces that name a campaign's state: the table's
  // pill and the controls modal's roll-up. A row reading "stopped" in the list beside
  // a "Paused" pill on that campaign's own page is one campaign described two ways.
  it("shares its running/paused words with the controls roll-up", () => {
    const lib = read("lib/campaign-controls.ts");
    expect(lib).toContain('active: "Active"');
    expect(lib).toContain('paused: "Paused"');
  });

  it("does no client cost math on the rows", () => {
    // No client-side cost derivation (the CPC-incident rule): no dividing a cost
    // by a count, no reduce-summing a cost breakdown.
    expect(table).not.toMatch(/committedCostUsd\s*\/\s*/);
    expect(table).not.toMatch(/\.reduce\(/);
  });

  // A row states what its campaign may spend in a day beside whether it is
  // running — the ceiling and the status are one answer in two cells.
  it("states each campaign's own daily ceiling, narrowed by the ROW's own offer", () => {
    // billing keys one ceiling per (offer x leg x channel), and the helper reads the
    // ROW's own offer off the campaign it is given, so a row cannot print a sibling
    // offer's money under this campaign's name. That is what makes the
    // brand-scoped list and the offer-scoped one agree about one campaign.
    expect(table).toContain("campaignBudgetCents(c, budgets, channels)");
    // The shared narrowing, so the table, the campaign Overview and Campaign
    // Settings cannot disagree about one campaign's money.
    expect(table).toContain('from "@/lib/campaign-budget"');
    // The key Campaign Settings and Offer Settings already read → no new poll.
    expect(table).toContain('["brandCampaignBudgets", brandId]');
    // Nothing is derived here: no summing ceilings, no dividing one.
    expect(table).not.toMatch(/budgetCents\s*[/*+]\s*/);
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
    it("states the leg above the channel in one cell, pinned to the mark's height", () => {
      const at = identity.indexOf("export function CampaignIdentity(");
      expect(at).toBeGreaterThan(-1);
      const cell = identity.slice(at, identity.indexOf("\n}\n", at));
      const legAt = cell.indexOf("<LegMark");
      const channelAt = cell.indexOf("<AcquisitionChannelMark");
      expect(legAt).toBeGreaterThan(-1);
      expect(channelAt).toBeGreaterThan(legAt);
      // The channel line is the quiet one, and it says what it is.
      expect(cell).toContain("text-xs");
      expect(cell).toContain("text-gray-500");
      expect(cell).toContain("Via");
      // Two lines whose leadings add to the leg tile's own 32px (`sm` = h-8),
      // so the row is the height of the icon rather than of whatever the text
      // needs. 18 on the second because the channel mark there is `xs` (18px).
      expect(cell).toContain("h-8");
      expect(cell).toContain("leading-[14px]");
      expect(cell).toContain("leading-[18px]");
      expect(cell).toContain('size="sm"');
      expect(cell).toContain('size="xs"');
    });
  });

  it("reveals on settle (resolved OR errored) so a failed query can't eternal-skeleton", () => {
    expect(table).toContain("campaignsQ.isError");
    expect(table).toContain("groupsQ.isError");
    // The per-channel fan-out is in the gate too: one channel's read failing must
    // not hold the table, and one still loading must not let it paint half its money.
    expect(table).toContain("channelGroupQs.every");
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
