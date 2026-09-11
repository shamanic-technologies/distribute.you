/**
 * ONE ROW PER WORKFLOW A CAMPAIGN'S CHANNEL CAN RUN, and what each one did — at the
 * grain the reader picked.
 *
 * A campaign is (offer x funnel x channel), and the channel is run by a WORKFLOW —
 * the pipeline that finds the people, writes the email and sends it. A customer
 * looking at one campaign wants to know which workflows their channel offers, which
 * one is running right now, and what each of the others produced. Nothing in the
 * product answered that: the money surfaces answer per campaign and per funnel, and
 * the workflow was a word on a settings screen.
 *
 * ── THE CATALOGUE DECIDES WHICH ROWS EXIST ───────────────────────────────────────
 *
 * The CATALOGUE (workflow-service) states which workflows the channel currently
 * offers; the FIGURES (features-service `?groupBy=workflow`, or the public fleet read)
 * state what each one produced. A workflow the channel offers and this scope has never
 * run keeps its row with no figures — "this exists, you have not tried it" is a real
 * answer, and it is the only reason the two sources are unioned at all.
 *
 * The mirror case is DROPPED: a figure group whose dynasty the catalogue no longer
 * carries is a RETIRED workflow, and a customer picking what to run next has no use
 * for a lineage nobody can put them on. It used to render as a `Retired` row on the
 * argument that deleting it deletes the campaign's own history; the owner read the
 * result and disagreed, and the history is still in the money above the table. So the
 * union is keyed on the catalogue, never on the figures.
 *
 * The key is the DYNASTY slug, which both producers already speak. A dynasty is a
 * workflow's identity across its versions: upgrading to v2 does not make it a
 * different workflow that earned nothing, and features-service folds the versions for
 * the same reason.
 *
 * ── WHICH ONE IS RUNNING IS THE CAMPAIGN'S OWN ANSWER ────────────────────────────
 *
 * campaign-service states the VERSIONED slug on the campaign row (`workflowSlug`),
 * so the dynasty it belongs to is resolved through whichever source names that
 * version — the catalogue's own `workflowSlug`, or a group's folded `workflowSlugs[]`.
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

import type { LegColumnPair } from "./campaign-leg-columns";

/** A dynasty the channel currently offers, as the catalogue states it. */
export interface WorkflowCatalogueRow {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  /** The versioned slug of the entry — how a campaign's own `workflowSlug` joins. */
  workflowSlug: string;
  version: number;
  /** Per-version lifecycle. A superseded version is not the dynasty's current face. */
  status?: string | null;
  /** How the work reaches people, as workflow-service tags it (`email` / `ads` / …). */
  channel?: string | null;
  /** How it relates to the people it reaches (`cold-outreach` / …). */
  audienceType?: string | null;
  /**
   * The chat-service model alias the DAG's content-generation call states, as
   * workflow-service derives it. Null = the call names none; never a default tier.
   */
  contentModel?: string | null;
  /** The prompt template that call asks for (`blind-discovery-email-v26`), verbatim. */
  contentPromptType?: string | null;
}

/** What one scope's money looks like through one dynasty, as features-service states it. */
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

/**
 * A dynasty and EVERY versioned slug that belongs to it, superseded ones included.
 *
 * This is the one authoritative version-to-dynasty map in the fleet, and it exists
 * because the two sources above cannot answer for a version that is neither current
 * nor has spent money in this scope:
 *
 *  - The CATALOGUE carries each dynasty's CURRENT version only (workflow-service
 *    filters its list to active versions whatever filter is passed), so a superseded
 *    version is absent from it by construction.
 *  - A revenue group's `workflowSlugs` is the set of versions that produced SPEND in
 *    the scope being read — not the dynasty's membership. A version the campaign is
 *    pinned to but never billed under, on this brand, is simply not in it.
 *
 * So a campaign pinned to a superseded version on a brand that never ran that exact
 * version was unnameable, permanently, and the `Running now` section vanished with
 * every figure on the page real and nothing red. Measured in production 2026-09-11:
 * all 7 distinct workflow slugs on the 14 live cold-email campaigns are non-active
 * versions; six resolve only because their slug happens to BE their dynasty slug (they
 * are v1), and `sales-cold-email-outreach-rudder-v3` resolved through nothing at all.
 * It grows every time a dynasty upgrades past v1.
 *
 * Read SCOPED TO ONE FEATURE. The unscoped listing is fleet-wide (625 dynasties, 1043
 * versions, 122KB on the day this shipped) and is every internal workflow codename we
 * have — those must never reach a customer's browser, where a workflow reads as "Pro
 * workflow 3" and never its codename.
 */
export interface WorkflowDynastyMembership {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  /** Every versioned slug in the lineage, superseded versions included. */
  workflowSlugs: readonly string[];
}

export interface CampaignWorkflowRow {
  workflowDynastySlug: string;
  /** The catalogue's name, else the producer's, else the slug. Never a blank cell. */
  workflowDynastyName: string;
  /** True for the workflow the campaign states it is running right now. */
  running: boolean;
  /** Present only when this scope has run it. Null = no figure, never zero. */
  positiveReplies: number | null;
  cpprCents: number | null;
  committedCostUsd: number | null;
  outreach: number | null;
  websiteClicks: number | null;
  cpcCents: number | null;
  roiMultiple: number | null;
  /** Which of the two served outcomes this row is counted and priced by. */
  outcomePair: WorkflowOutcomePair;
  /** Fewer than the bar's worth of the PAIR's outcome behind the price. */
  learning: boolean;
  channel: string | null;
  audienceType: string | null;
  /** Both catalogue-only: workflow-service is the one producer that states them. */
  contentModel: string | null;
  contentPromptType: string | null;
}

/**
 * WHICH OUTCOME THIS CAMPAIGN'S ROWS ARE PRICED BY.
 *
 * A campaign performs ONE leg of its funnel, so the outcome a workflow produced for it
 * is that leg's own: cold email onto a visit-led funnel buys a WEBSITE VISIT and
 * nothing else, while the same channel onto the reply-led funnel buys a SALES INTEREST.
 * The table hardcoded the reply pair, so a visit-led campaign read `0 sales interests`
 * on every row while it was measurably buying visits — the same mistake #3880 closed on
 * the Audiences table, one surface over: a campaign-scoped surface keyed on the funnel
 * instead of the leg.
 *
 * Only two pairs exist here, because only two are SERVED per workflow: the grouped read
 * carries `recipientsRepliesPositive`/`cpprCents` and `recipientsClicked`/`cpcCents` and
 * nothing else. A leg landing on a signup, a filled form, a sale or a meeting has no
 * per-workflow figure at all, so the caller keeps the reply pair there — exactly what
 * the page read before legs were consulted, rather than a column of dashes.
 */
export type WorkflowOutcomePair = "reply" | "visit";

/**
 * The pair a campaign's own LEG earns, or the reply pair when it earns none.
 *
 * The leg's column pair is the Audiences table's vocabulary (`lib/campaign-leg-columns`),
 * and this narrows it to the two outcomes features-service serves PER WORKFLOW. A leg
 * landing on a signup, a filled form, a sale, or either meeting step has no per-workflow
 * figure, so the answer is the reply pair — the columns this table read before legs were
 * consulted. That fallback is deliberate rather than a blank: a column of dashes tells a
 * reader less than the figures they had yesterday, and a leg we cannot place is still a
 * campaign whose replies were counted.
 */
export function workflowOutcomePairFor(
  legPair: LegColumnPair | null | undefined,
): WorkflowOutcomePair {
  return legPair === "visit" ? "visit" : "reply";
}

/** The count this row is measured by — the pair's own, never the other one's. */
export function workflowOutcomeCount(row: CampaignWorkflowRow): number | null {
  return row.outcomePair === "visit" ? row.websiteClicks : row.positiveReplies;
}

/** The price this row states — the pair's own. */
export function workflowOutcomeCostCents(row: CampaignWorkflowRow): number | null {
  return row.outcomePair === "visit" ? row.cpcCents : row.cpprCents;
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
 * Resolved from whichever source NAMES that version, in order: the catalogue's entry,
 * a group's folded `workflowSlugs`, then the dynasty MEMBERSHIP map. A campaign whose
 * workflow no source knows states no running row rather than a guessed one — framing
 * the wrong row as live is worse than framing none.
 *
 * The membership map is tried LAST deliberately, although it is the authoritative one:
 * the three sources agree by construction wherever more than one answers, so ordering
 * cannot change a resolution — and putting the new source at the end makes every case
 * that already resolved byte-identical to before. It adds coverage, never a different
 * answer.
 *
 * Never by string-prefix arithmetic on the slug: a dynasty slug is opaque, and
 * `<dynasty>-v2` is a convention rather than a contract.
 *
 * ⚠️ WHICH source is available DEPENDS ON THE GRAIN, which is exactly why no builder
 * may call this itself — see `resolveRunningWorkflow`.
 */
export function runningDynastyFor(
  campaignWorkflowSlug: string | null | undefined,
  catalogue: readonly WorkflowCatalogueRow[],
  groups: readonly WorkflowRevenueGroup[],
  memberships: readonly WorkflowDynastyMembership[] = [],
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
  for (const family of memberships) {
    if (family.workflowDynastySlug === slug) return family.workflowDynastySlug;
    if (family.workflowSlugs.includes(slug)) return family.workflowDynastySlug;
  }
  return null;
}

/** The workflow a campaign states it is running, as every grain must state it. */
export interface RunningWorkflow {
  /** The dynasty, once some source has named the campaign's version. Null = unknown. */
  dynastySlug: string | null;
  /** Its name, from whichever source named it. Null = nothing named it; use the slug. */
  dynastyName: string | null;
}

/**
 * WHICH WORKFLOW THE CAMPAIGN IS RUNNING — a fact about the CAMPAIGN, never about the
 * grain the reader picked.
 *
 * campaign-service states a VERSIONED slug on the row (`sales-cold-email-outreach-
 * osprey-v4`), and the catalogue only carries each dynasty's CURRENT version, so a
 * campaign pinned to anything but the newest version is nameable ONLY by a revenue
 * group's folded `workflowSlugs`. Measured in prod 2026-09-11: of the 30 cold-email
 * campaigns carrying a versioned slug, ZERO match their dynasty's current catalogue
 * entry — so for every one of them the catalogue alone resolves nothing.
 *
 * That is why resolution takes EVERY group set the page holds rather than the one its
 * active tab is reading. The GLOBAL grain reads two cross-org endpoints and has no
 * groups at all, so a builder resolving from its own source answered `null` there and
 * the `Running now` section simply VANISHED on that tab while the other three rendered
 * it — one page contradicting itself about what is running, with every figure on it
 * real. Resolve once, here, and hand the answer to every builder.
 *
 * A group set that has not loaded contributes nothing rather than blocking: the first
 * source that names the version wins, and an unnameable version answers `{null, null}`
 * so the caller states no running row rather than a guessed one.
 *
 * ── THE THIRD SOURCE, AND WHY THE OTHER TWO ARE NOT ENOUGH ───────────────────────
 *
 * Both of the sources above can only ever name a version that is either the dynasty's
 * CURRENT one or one that has already SPENT in the scope being read. A campaign pinned
 * to a superseded version, on a brand that never billed under that exact version, is
 * therefore unnameable by construction — and that is the ordinary case rather than an
 * edge one (prod 2026-09-11: `sales-cold-email-outreach-rudder-v3`, whose brand ran v2
 * and v5 and never v3). `memberships` is workflow-service's own version-to-dynasty map,
 * read scoped to this channel, and it is the only thing in the fleet that answers.
 *
 * It defaults to empty so a failed or in-flight read degrades to exactly the previous
 * behaviour rather than deleting the section — losing `Running now` to a blip is the
 * regression this whole line of work exists to close.
 */
export function resolveRunningWorkflow(
  campaignWorkflowSlug: string | null | undefined,
  catalogue: readonly WorkflowCatalogueRow[],
  groupSets: readonly (readonly WorkflowRevenueGroup[])[],
  memberships: readonly WorkflowDynastyMembership[] = [],
): RunningWorkflow {
  const slug = campaignWorkflowSlug?.trim();
  if (!slug) return { dynastySlug: null, dynastyName: null };
  const collapsed = collapseWorkflowCatalogue(catalogue);
  const flat = groupSets.flat();
  const dynastySlug = runningDynastyFor(slug, collapsed, flat, memberships);
  if (!dynastySlug) return { dynastySlug: null, dynastyName: null };
  const named =
    collapsed.find((c) => c.workflowDynastySlug === dynastySlug)?.workflowDynastyName ??
    flat.find((g) => g.workflowDynastySlug === dynastySlug)?.workflowDynastyName ??
    memberships.find((m) => m.workflowDynastySlug === dynastySlug)?.workflowDynastyName ??
    null;
  return { dynastySlug, dynastyName: named };
}

/**
 * The rows the Workflows table renders, one per workflow the channel OFFERS.
 *
 * Ordering is the RANKING's job (`lib/workflow-rank-why`, which sorts on the producer's
 * own `resolved.costPerOutcomeUsd`) — this returns them in catalogue order so the
 * caller has a stable list to look a dynasty up in.
 *
 * `isLearning` is injected rather than imported so this module stays alias-free; the
 * caller passes the repo's ONE bar (`lib/learning-threshold`), never a second copy.
 */
export function buildCampaignWorkflowRows({
  catalogue,
  groups,
  running,
  pair,
  isLearning,
}: {
  catalogue: readonly WorkflowCatalogueRow[];
  groups: readonly WorkflowRevenueGroup[];
  /** Resolved ONCE by the caller (`resolveRunningWorkflow`), never re-derived here. */
  running: RunningWorkflow;
  /**
   * The outcome the campaign's own LEG buys. Required rather than defaulted, so a new
   * caller answers the question instead of silently inheriting the reply pair — which
   * is how a visit-led campaign came to read zero sales interests on every row.
   */
  pair: WorkflowOutcomePair;
  isLearning: (count: number | null | undefined) => boolean;
}): CampaignWorkflowRow[] {
  const collapsed = collapseWorkflowCatalogue(catalogue);
  const runningDynasty = running.dynastySlug;

  const byDynasty = new Map<string, WorkflowRevenueGroup>();
  for (const g of groups) byDynasty.set(g.workflowDynastySlug, g);

  const rows = collapsed.map((entry) => {
    const group = byDynasty.get(entry.workflowDynastySlug);
    const positiveReplies = group?.recipientsRepliesPositive ?? null;
    const websiteClicks = group?.recipientsClicked ?? null;
    // The bar is read against the outcome the row STATES, never the other one: a
    // visit-led campaign with 400 visits is measured, whatever its reply count is.
    const outcome = pair === "visit" ? websiteClicks : positiveReplies;
    return {
      workflowDynastySlug: entry.workflowDynastySlug,
      workflowDynastyName: entry.workflowDynastyName || entry.workflowDynastySlug,
      running: entry.workflowDynastySlug === runningDynasty,
      positiveReplies,
      cpprCents: group?.cpprCents ?? null,
      committedCostUsd: group?.committedCostUsd ?? null,
      outreach: group?.recipientsContacted ?? null,
      websiteClicks,
      cpcCents: group?.cpcCents ?? null,
      roiMultiple: group?.roiMultiple ?? null,
      outcomePair: pair,
      // A row this scope has never run is not "learning" — there is nothing to be
      // thin. It has no price at all, which the null already says.
      learning: group !== undefined && isLearning(outcome),
      channel: entry.channel ?? null,
      audienceType: entry.audienceType ?? null,
      contentModel: entry.contentModel ?? null,
      contentPromptType: entry.contentPromptType ?? null,
    };
  });

  return withRunningRow(rows, running, (dynastySlug) => {
    const group = byDynasty.get(dynastySlug);
    const positiveReplies = group?.recipientsRepliesPositive ?? null;
    const websiteClicks = group?.recipientsClicked ?? null;
    const outcome = pair === "visit" ? websiteClicks : positiveReplies;
    return {
      positiveReplies,
      cpprCents: group?.cpprCents ?? null,
      committedCostUsd: group?.committedCostUsd ?? null,
      outreach: group?.recipientsContacted ?? null,
      websiteClicks,
      cpcCents: group?.cpcCents ?? null,
      roiMultiple: group?.roiMultiple ?? null,
      outcomePair: pair,
      learning: group !== undefined && isLearning(outcome),
      name: group?.workflowDynastyName ?? null,
    };
  });
}

/**
 * THE RUNNING WORKFLOW ALWAYS GETS A ROW, even when the catalogue no longer offers it.
 *
 * Rows are keyed on the catalogue on purpose — a lineage nobody can be put on is not an
 * option for a reader picking what to run next (#4047). That rule has one exception it
 * cannot survive without: the workflow the campaign is running RIGHT NOW. A dynasty
 * retired while a campaign still runs it is absent from the catalogue, so the page
 * dropped its row entirely and then had nothing to put under a heading whose whole job
 * is to say what is happening — `Running now` vanished and the workflow appeared in no
 * section at all. Measured in prod 2026-09-11: 17 cold-email campaigns are pinned to
 * `tectonic` or `atlantis`, neither of which the catalogue carries.
 *
 * The synthesized row states only what a source actually named: its figures come from
 * whichever group/fleet row carries the dynasty, and everything the CATALOGUE alone
 * knows (the model, the template, the channel) reads null rather than a guess.
 */
function withRunningRow(
  rows: CampaignWorkflowRow[],
  running: RunningWorkflow,
  figuresFor: (dynastySlug: string) => Omit<
    CampaignWorkflowRow,
    "workflowDynastySlug" | "workflowDynastyName" | "running" | "channel" | "audienceType" | "contentModel" | "contentPromptType"
  > & { name: string | null },
): CampaignWorkflowRow[] {
  const slug = running.dynastySlug;
  if (!slug) return rows;
  if (rows.some((r) => r.workflowDynastySlug === slug)) return rows;
  const { name, ...figures } = figuresFor(slug);
  return [
    {
      workflowDynastySlug: slug,
      workflowDynastyName: name || running.dynastyName || slug,
      running: true,
      ...figures,
      channel: null,
      audienceType: null,
      contentModel: null,
      contentPromptType: null,
    },
    ...rows,
  ];
}

/** One fleet row, as the public cross-org cost read states it. */
export interface FleetWorkflowCost {
  workflowDynastySlug: string;
  workflowDynastyName: string;
  spentUsd: number;
  costPerOutcomeUsd: number | null;
  /** Cross-org outcome counts the same row carries. */
  observedPositiveReplies: number | null;
  observedClicks: number | null;
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
