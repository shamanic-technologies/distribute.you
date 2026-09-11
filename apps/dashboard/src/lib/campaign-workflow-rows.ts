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
  /** Fewer than the bar's worth of sales interests behind the price. */
  learning: boolean;
  channel: string | null;
  audienceType: string | null;
  /** Both catalogue-only: workflow-service is the one producer that states them. */
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
 *
 * ⚠️ WHICH source is available DEPENDS ON THE GRAIN, which is exactly why no builder
 * may call this itself — see `resolveRunningWorkflow`.
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
 */
export function resolveRunningWorkflow(
  campaignWorkflowSlug: string | null | undefined,
  catalogue: readonly WorkflowCatalogueRow[],
  groupSets: readonly (readonly WorkflowRevenueGroup[])[],
): RunningWorkflow {
  const slug = campaignWorkflowSlug?.trim();
  if (!slug) return { dynastySlug: null, dynastyName: null };
  const collapsed = collapseWorkflowCatalogue(catalogue);
  const flat = groupSets.flat();
  const dynastySlug = runningDynastyFor(slug, collapsed, flat);
  if (!dynastySlug) return { dynastySlug: null, dynastyName: null };
  const named =
    collapsed.find((c) => c.workflowDynastySlug === dynastySlug)?.workflowDynastyName ??
    flat.find((g) => g.workflowDynastySlug === dynastySlug)?.workflowDynastyName ??
    null;
  return { dynastySlug, dynastyName: named };
}

/**
 * The rows the Workflows table renders, one per workflow the channel OFFERS.
 *
 * Ordering is the SECTIONS' job (`sectionCampaignWorkflowRows`) — this returns them in
 * catalogue order so the caller has a stable list to look a dynasty up in.
 *
 * `isLearning` is injected rather than imported so this module stays alias-free; the
 * caller passes the repo's ONE bar (`lib/learning-threshold`), never a second copy.
 */
export function buildCampaignWorkflowRows({
  catalogue,
  groups,
  running,
  isLearning,
}: {
  catalogue: readonly WorkflowCatalogueRow[];
  groups: readonly WorkflowRevenueGroup[];
  /** Resolved ONCE by the caller (`resolveRunningWorkflow`), never re-derived here. */
  running: RunningWorkflow;
  isLearning: (count: number | null | undefined) => boolean;
}): CampaignWorkflowRow[] {
  const collapsed = collapseWorkflowCatalogue(catalogue);
  const runningDynasty = running.dynastySlug;

  const byDynasty = new Map<string, WorkflowRevenueGroup>();
  for (const g of groups) byDynasty.set(g.workflowDynastySlug, g);

  const rows = collapsed.map((entry) => {
    const group = byDynasty.get(entry.workflowDynastySlug);
    const positiveReplies = group?.recipientsRepliesPositive ?? null;
    return {
      workflowDynastySlug: entry.workflowDynastySlug,
      workflowDynastyName: entry.workflowDynastyName || entry.workflowDynastySlug,
      running: entry.workflowDynastySlug === runningDynasty,
      positiveReplies,
      cpprCents: group?.cpprCents ?? null,
      committedCostUsd: group?.committedCostUsd ?? null,
      outreach: group?.recipientsContacted ?? null,
      websiteClicks: group?.recipientsClicked ?? null,
      cpcCents: group?.cpcCents ?? null,
      roiMultiple: group?.roiMultiple ?? null,
      // A row this scope has never run is not "learning" — there is nothing to be
      // thin. It has no price at all, which the null already says.
      learning: group !== undefined && isLearning(positiveReplies),
      channel: entry.channel ?? null,
      audienceType: entry.audienceType ?? null,
      contentModel: entry.contentModel ?? null,
      contentPromptType: entry.contentPromptType ?? null,
    };
  });

  return withRunningRow(rows, running, (dynastySlug) => {
    const group = byDynasty.get(dynastySlug);
    const positiveReplies = group?.recipientsRepliesPositive ?? null;
    return {
      positiveReplies,
      cpprCents: group?.cpprCents ?? null,
      committedCostUsd: group?.committedCostUsd ?? null,
      outreach: group?.recipientsContacted ?? null,
      websiteClicks: group?.recipientsClicked ?? null,
      cpcCents: group?.cpcCents ?? null,
      roiMultiple: group?.roiMultiple ?? null,
      learning: group !== undefined && isLearning(positiveReplies),
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

/** One fleet OUTREACH row, as the public ranked read states it. */
export interface FleetWorkflowOutreach {
  workflowDynastySlug: string;
  recipientsContacted: number | null;
}

/**
 * The same rows, at the GLOBAL grain: what each workflow did across every client.
 *
 * Two public reads, joined on the dynasty the catalogue already keys on — the cost
 * read carries the money and the outcome counts, the ranked read carries the outreach.
 * OUTREACH is `recipientsContacted`, never `completedRuns`: a workflow that contacted
 * 638 people logs ~15,000 runs, so a run count under an "Outreach" label overstates it
 * ~23x, which is a mistake this repo has already paid for once.
 *
 * The fleet's basis is INCURRED (comped spend at full value — what the workflow costs
 * to produce an outcome), not what any one customer was charged. The surface states
 * that in its own words; nothing here reconciles the two, because they answer
 * different questions.
 *
 * The cost read serves dollars and the table states cents, so `costPerOutcomeUsd` is
 * converted to cents for ONE reason: every row in this model carries `cpprCents`, and
 * a second unit on the same field is how a column comes to mean two things. That is a
 * unit change on a served figure, not a metric computed here.
 */
export function buildFleetWorkflowRows({
  catalogue,
  fleet,
  outreach,
  running,
  isLearning,
}: {
  catalogue: readonly WorkflowCatalogueRow[];
  fleet: readonly FleetWorkflowCost[];
  outreach: readonly FleetWorkflowOutreach[];
  /**
   * Resolved ONCE by the caller. This grain reads two cross-org endpoints and holds no
   * revenue groups, so a campaign pinned to anything but its dynasty's current version
   * is unnameable from here — which is exactly how `Running now` came to vanish on this
   * tab alone while the other three rendered it.
   */
  running: RunningWorkflow;
  isLearning: (count: number | null | undefined) => boolean;
}): CampaignWorkflowRow[] {
  const collapsed = collapseWorkflowCatalogue(catalogue);
  const runningDynasty = running.dynastySlug;

  const costBy = new Map<string, FleetWorkflowCost>();
  for (const f of fleet) costBy.set(f.workflowDynastySlug, f);
  const outreachBy = new Map<string, FleetWorkflowOutreach>();
  for (const o of outreach) outreachBy.set(o.workflowDynastySlug, o);

  const rows = collapsed.map((entry) => {
    const cost = costBy.get(entry.workflowDynastySlug);
    const reach = outreachBy.get(entry.workflowDynastySlug);
    const positiveReplies = cost?.observedPositiveReplies ?? null;
    return {
      workflowDynastySlug: entry.workflowDynastySlug,
      workflowDynastyName: entry.workflowDynastyName || entry.workflowDynastySlug,
      running: entry.workflowDynastySlug === runningDynasty,
      positiveReplies,
      cpprCents:
        cost?.costPerOutcomeUsd == null ? null : Math.round(cost.costPerOutcomeUsd * 100),
      committedCostUsd: cost?.spentUsd ?? null,
      outreach: reach?.recipientsContacted ?? null,
      websiteClicks: cost?.observedClicks ?? null,
      // The fleet read carries neither a return nor a per-click price, and inventing
      // one from the two figures it does carry is the division this model refuses.
      cpcCents: null,
      roiMultiple: null,
      learning: cost !== undefined && isLearning(positiveReplies),
      channel: entry.channel ?? null,
      audienceType: entry.audienceType ?? null,
      contentModel: entry.contentModel ?? null,
      contentPromptType: entry.contentPromptType ?? null,
    };
  });

  return withRunningRow(rows, running, (dynastySlug) => {
    const cost = costBy.get(dynastySlug);
    const reach = outreachBy.get(dynastySlug);
    const positiveReplies = cost?.observedPositiveReplies ?? null;
    return {
      positiveReplies,
      cpprCents:
        cost?.costPerOutcomeUsd == null ? null : Math.round(cost.costPerOutcomeUsd * 100),
      committedCostUsd: cost?.spentUsd ?? null,
      outreach: reach?.recipientsContacted ?? null,
      websiteClicks: cost?.observedClicks ?? null,
      cpcCents: null,
      roiMultiple: null,
      learning: cost !== undefined && isLearning(positiveReplies),
      name: cost?.workflowDynastyName ?? null,
    };
  });
}

/**
 * THE THREE SECTIONS THE PAGE RENDERS, and what each one is FOR.
 *
 *  · RUNNING NOW — the workflow the campaign states it is running. It appears here and
 *    NOWHERE ELSE: a reader answering "what is happening right now" should not also
 *    have to find the same row again further down.
 *
 *  · MEASURED — every workflow that produced at least ONE sales interest at the grain
 *    being read, best first.
 *
 *  · NOT MEASURED YET — nothing produced yet, ordered by how much outreach has gone
 *    through it, which is what shows the bar being approached.
 *
 * MEMBERSHIP is the COUNT (owner-decided: at least one sales interest, or none), so
 * every row lands in exactly one section. ORDER inside MEASURED is the price, and a
 * row under the learning bar has no price to be ranked on — it is deliberately not
 * showing one — so it sinks below the priced rows and orders among its peers by the
 * count beside it. Ranking a row on a figure the table is withholding reads as
 * unordered, which is the mistake this ordering exists to avoid.
 *
 * Cheapest-first is "best first" for a cost. The comparator lives here, alone, so
 * flipping it is one line rather than a hunt through a component.
 */
export interface CampaignWorkflowSections {
  running: CampaignWorkflowRow[];
  measured: CampaignWorkflowRow[];
  notMeasured: CampaignWorkflowRow[];
}

/** A price this table may RANK on: stated, and standing on enough outcomes. */
function rankablePrice(r: CampaignWorkflowRow): number | null {
  return r.learning || r.cpprCents == null ? null : r.cpprCents;
}

function byName(a: CampaignWorkflowRow, b: CampaignWorkflowRow): number {
  return a.workflowDynastyName.localeCompare(b.workflowDynastyName);
}

export function sectionCampaignWorkflowRows(
  rows: readonly CampaignWorkflowRow[],
): CampaignWorkflowSections {
  const running = rows.filter((r) => r.running);
  const rest = rows.filter((r) => !r.running);

  const measured = rest
    .filter((r) => (r.positiveReplies ?? 0) >= 1)
    .sort((a, b) => {
      const pa = rankablePrice(a);
      const pb = rankablePrice(b);
      // CHEAPEST FIRST among the rows that state a price; flip the sign here to go
      // dearest-first and every surface follows.
      if (pa != null && pb != null) return pa - pb;
      if (pa != null) return -1;
      if (pb != null) return 1;
      const oa = a.positiveReplies ?? -1;
      const ob = b.positiveReplies ?? -1;
      if (oa !== ob) return ob - oa;
      return byName(a, b);
    });

  const notMeasured = rest
    .filter((r) => (r.positiveReplies ?? 0) < 1)
    .sort((a, b) => {
      const oa = a.outreach ?? -1;
      const ob = b.outreach ?? -1;
      if (oa !== ob) return ob - oa;
      return byName(a, b);
    });

  return { running, measured, notMeasured };
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
