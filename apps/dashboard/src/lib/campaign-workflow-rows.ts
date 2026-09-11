/**
 * ONE ROW PER WORKFLOW A CAMPAIGN'S CHANNEL CAN RUN, and what each one did for THIS
 * campaign.
 *
 * A campaign is (offer x funnel x channel), and the channel is run by a WORKFLOW —
 * the pipeline that finds the people, writes the email and sends it. A customer
 * looking at one campaign wants to know which workflows their channel offers, which
 * one is running right now, and what each of the others produced when it ran for
 * them. Nothing in the product answered that: the money surfaces answer per campaign
 * and per funnel, and the workflow was a word on a settings screen.
 *
 * ── THE ROWS ARE THE UNION OF TWO SOURCES, AND THAT IS LOAD-BEARING ──────────────
 *
 * The CATALOGUE (workflow-service) states which workflows the channel currently
 * offers. The REVENUE GROUPS (features-service `?groupBy=workflow`) state which ones
 * this campaign has actually run and what they cost. Neither is a superset:
 *
 *   - a workflow the channel offers and this campaign has never run has a catalogue
 *     entry and no group — it is a real answer ("this exists, you have not tried
 *     it"), so it renders with no figures rather than being dropped;
 *   - a workflow that RAN and has since been RETIRED has a group and no catalogue
 *     entry, because the gateway's `/v1/workflows` proxy asks workflow-service for
 *     the EXECUTABLE set. Dropping it would delete the campaign's own history from
 *     the page that exists to show it — and a retired lineage is exactly the
 *     workflow a "what burned money" question is about.
 *
 * So the union, keyed on the DYNASTY slug both producers already speak. A dynasty is
 * a workflow's identity across its versions: upgrading to v2 does not make it a
 * different workflow that earned nothing, and features-service folds the versions
 * for the same reason.
 *
 * ── WHICH ONE IS RUNNING IS THE CAMPAIGN'S OWN ANSWER ────────────────────────────
 *
 * campaign-service states the VERSIONED slug on the campaign row (`workflowSlug`),
 * so the dynasty it belongs to is resolved through whichever source names that
 * version — the catalogue's own `workflowSlug`, or the group's `workflowSlugs[]`.
 * Never by string-prefix arithmetic on the slug: a dynasty slug is opaque, and
 * `<dynasty>-v2` is a convention rather than a contract.
 *
 * ── NOTHING HERE DIVIDES ─────────────────────────────────────────────────────────
 *
 * Every figure on a row is a SERVED field read verbatim. The cost per sales interest
 * is features-service's own `cpprCents` for that workflow, not spend over replies
 * computed here — a browser-side ratio drifts from the producer the moment either
 * side changes scope, and it is the compute-a-stat-in-the-browser bug this repo
 * already records.
 *
 * Alias-free (its only imports are types, erased at build) so it carries real unit
 * tests. Keep it that way.
 */

/** A dynasty the channel currently offers, as the catalogue states it. */
export interface WorkflowCatalogueRow {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  /** The versioned slug of the entry — how a campaign's own `workflowSlug` joins. */
  workflowSlug: string;
  version: number;
  /** Per-version lifecycle. A superseded version is not the dynasty's current face. */
  status?: string | null;
  /** Providers the workflow calls, for the row's marks. Domain null = no logo drawn. */
  requiredProviders?: readonly { name: string; domain: string | null }[];
  /** How the work reaches people, as workflow-service tags it (`email` / `ads` / …). */
  channel?: string | null;
  /** How it relates to the people it reaches (`cold-outreach` / …). */
  audienceType?: string | null;
  /**
   * The chat-service model alias the DAG's content-generation call states, as
   * workflow-service derives it. Null = the call names none; never a default tier.
   */
  contentModel?: string | null;
  /** The prompt template that call asks for (`cold-email-v39`), verbatim. */
  contentPromptType?: string | null;
}

/** What this campaign's money looks like through one dynasty, as features-service states it. */
export interface WorkflowRevenueGroup {
  workflowDynastySlug: string;
  workflowDynastyName: string | null;
  workflowSlugs: readonly string[];
  totalPipelineUsd: number | null;
  committedCostUsd: number | null;
  roiMultiple: number | null;
  costOfAcquisitionPct: number | null;
  recipientsContacted: number | null;
  recipientsClicked: number | null;
  recipientsRepliesPositive: number | null;
  cpprCents: number | null;
  cpcCents: number | null;
}

export interface CampaignWorkflowRow {
  workflowDynastySlug: string;
  /** The catalogue's name, else the producer's, else the slug. Never a blank cell. */
  workflowDynastyName: string;
  /** True for the workflow the campaign states it is running right now. */
  running: boolean;
  /** Absent from the catalogue = workflow-service no longer offers it. */
  retired: boolean;
  /** Present only when this campaign has run it. Null = no figure, never zero. */
  positiveReplies: number | null;
  cpprCents: number | null;
  committedCostUsd: number | null;
  outreach: number | null;
  websiteClicks: number | null;
  cpcCents: number | null;
  roiMultiple: number | null;
  /** Fewer than the bar's worth of sales interests behind the price. */
  learning: boolean;
  providers: readonly { name: string; domain: string | null }[];
  channel: string | null;
  audienceType: string | null;
  /**
   * Catalogue-only, both of them: a RETIRED dynasty has a revenue group and no
   * catalogue entry, so workflow-service states neither for it and the row reads null
   * — which is the honest answer ("we no longer hold this workflow's shape"), not a
   * gap to fill from the group.
   */
  contentModel: string | null;
  contentPromptType: string | null;
}

/**
 * One catalogue entry per dynasty: the newest version that is not superseded.
 *
 * The gateway asks workflow-service for the EXECUTABLE set, so a deprecated version
 * rarely arrives at all — the guard is here because "rarely" is not "never" and a
 * superseded version's name is not the dynasty's current one.
 */
export function collapseWorkflowCatalogue(
  workflows: readonly WorkflowCatalogueRow[],
): WorkflowCatalogueRow[] {
  const byDynasty = new Map<string, WorkflowCatalogueRow>();
  for (const w of workflows) {
    if (!w.workflowDynastySlug) continue;
    if (w.status === "deprecated") continue;
    const current = byDynasty.get(w.workflowDynastySlug);
    if (current && current.version >= w.version) continue;
    byDynasty.set(w.workflowDynastySlug, w);
  }
  return [...byDynasty.values()];
}

/**
 * The dynasty a campaign's own versioned workflow slug belongs to, or null.
 *
 * Resolved from whichever source NAMES that version — the catalogue's entry, or a
 * group's folded `workflowSlugs`. A campaign whose workflow neither source knows
 * states no running row rather than a guessed one: framing the wrong row as live is
 * worse than framing none.
 */
export function runningDynastyFor(
  campaignWorkflowSlug: string | null | undefined,
  catalogue: readonly WorkflowCatalogueRow[],
  groups: readonly WorkflowRevenueGroup[],
): string | null {
  const slug = campaignWorkflowSlug?.trim();
  if (!slug) return null;
  for (const entry of catalogue) {
    if (entry.workflowSlug === slug) return entry.workflowDynastySlug;
    // A campaign can also state the dynasty itself (the first version of a lineage
    // is routinely slugged as its dynasty), so an exact dynasty match counts.
    if (entry.workflowDynastySlug === slug) return entry.workflowDynastySlug;
  }
  for (const group of groups) {
    if (group.workflowDynastySlug === slug) return group.workflowDynastySlug;
    if (group.workflowSlugs.includes(slug)) return group.workflowDynastySlug;
  }
  return null;
}

/** Providers deduped by domain, keeping the first name seen. Nameless entries dropped. */
function dedupeProviders(
  providers: readonly { name: string; domain: string | null }[] | undefined,
): { name: string; domain: string | null }[] {
  if (!providers?.length) return [];
  const seen = new Set<string>();
  const out: { name: string; domain: string | null }[] = [];
  for (const p of providers) {
    if (!p.name) continue;
    const key = p.domain ?? `name:${p.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: p.name, domain: p.domain ?? null });
  }
  return out;
}

/**
 * The rows a campaign's Workflows table renders, ordered.
 *
 * ORDER: the running workflow first — it is the answer to "what is happening right
 * now", and a reader should not have to hunt for it. Then by cost per sales interest
 * ASCENDING, which is what the table is FOR (cheapest outcome wins). A row that is
 * LEARNING, or that this campaign has never run, has no price to be ranked on and
 * sinks below every measured row, ordered among its peers by outreach descending
 * (the count beside the price, and the thing that shows the bar being approached) —
 * ranking a row on a number the table is deliberately not showing reads as unordered.
 *
 * `isLearning` is injected rather than imported so this module stays alias-free; the
 * caller passes the repo's ONE bar (`lib/learning-threshold`), never a second copy.
 */
export function buildCampaignWorkflowRows({
  catalogue,
  groups,
  campaignWorkflowSlug,
  isLearning,
}: {
  catalogue: readonly WorkflowCatalogueRow[];
  groups: readonly WorkflowRevenueGroup[];
  campaignWorkflowSlug: string | null | undefined;
  isLearning: (count: number | null | undefined) => boolean;
}): CampaignWorkflowRow[] {
  const collapsed = collapseWorkflowCatalogue(catalogue);
  const runningDynasty = runningDynastyFor(campaignWorkflowSlug, collapsed, groups);

  const byDynasty = new Map<string, WorkflowRevenueGroup>();
  for (const g of groups) byDynasty.set(g.workflowDynastySlug, g);

  const rows = new Map<string, CampaignWorkflowRow>();

  const push = (
    slug: string,
    name: string,
    entry: WorkflowCatalogueRow | undefined,
    group: WorkflowRevenueGroup | undefined,
  ) => {
    if (rows.has(slug)) return;
    const positiveReplies = group?.recipientsRepliesPositive ?? null;
    rows.set(slug, {
      workflowDynastySlug: slug,
      workflowDynastyName: name,
      running: slug === runningDynasty,
      retired: entry === undefined,
      positiveReplies,
      cpprCents: group?.cpprCents ?? null,
      committedCostUsd: group?.committedCostUsd ?? null,
      outreach: group?.recipientsContacted ?? null,
      websiteClicks: group?.recipientsClicked ?? null,
      cpcCents: group?.cpcCents ?? null,
      roiMultiple: group?.roiMultiple ?? null,
      // A row this campaign has never run is not "learning" — there is nothing to be
      // thin. It has no price at all, which the null already says.
      learning: group !== undefined && isLearning(positiveReplies),
      providers: dedupeProviders(entry?.requiredProviders),
      channel: entry?.channel ?? null,
      audienceType: entry?.audienceType ?? null,
      contentModel: entry?.contentModel ?? null,
      contentPromptType: entry?.contentPromptType ?? null,
    });
  };

  for (const entry of collapsed) {
    push(
      entry.workflowDynastySlug,
      entry.workflowDynastyName || entry.workflowDynastySlug,
      entry,
      byDynasty.get(entry.workflowDynastySlug),
    );
  }
  for (const group of groups) {
    push(
      group.workflowDynastySlug,
      group.workflowDynastyName || group.workflowDynastySlug,
      undefined,
      group,
    );
  }

  // A price this table may RANK on: measured, and standing on enough outcomes.
  const rank = (r: CampaignWorkflowRow): number | null =>
    r.learning || r.cpprCents == null ? null : r.cpprCents;

  return [...rows.values()].sort((a, b) => {
    if (a.running !== b.running) return a.running ? -1 : 1;
    const ra = rank(a);
    const rb = rank(b);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    const oa = a.outreach ?? -1;
    const ob = b.outreach ?? -1;
    if (oa !== ob) return ob - oa;
    return a.workflowDynastyName.localeCompare(b.workflowDynastyName);
  });
}

/** One fleet row, as the public cross-org read states it. */
export interface FleetWorkflowCost {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  spentUsd: number;
  costPerOutcomeUsd: number | null;
}

/**
 * This workflow against the fleet, on ONE served figure each.
 *
 * The fleet read is CROSS-ORG and counts comped spend at full value (its own
 * `costBasis: "incurred"`), while everything else on these pages is what THIS
 * customer was CHARGED. Two different questions sharing the words "cost per
 * outcome", so the surface states which is which rather than printing them as one
 * series — and the MEDIAN is the fleet's central figure, never the mean, because one
 * workflow at an absurd rate drags an average and describes nobody.
 *
 * Null when the fleet has no priced row at all: "we could not measure this" is not a
 * zero, and it is not a claim that this workflow beats everyone.
 */
export function fleetComparison(
  dynastySlug: string,
  fleet: readonly FleetWorkflowCost[],
): { mine: number | null; median: number | null; best: number | null } {
  const priced = fleet
    .map((f) => f.costPerOutcomeUsd)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const mine = fleet.find((f) => f.workflowDynastySlug === dynastySlug)?.costPerOutcomeUsd ?? null;
  if (priced.length === 0) return { mine, median: null, best: null };
  const mid = Math.floor(priced.length / 2);
  const median =
    priced.length % 2 === 1 ? priced[mid] : (priced[mid - 1] + priced[mid]) / 2;
  return { mine, median, best: priced[0] };
}
