/**
 * WHY THE WORKFLOWS ARE IN THIS ORDER, in the producer's own evidence and nobody
 * else's arithmetic.
 *
 * The Workflows table used to order its rows on a campaign-grain price and split them
 * into three sections, and none of that was the ranking the system actually uses.
 * campaign-service picks the workflow a campaign runs off features-service's
 * `workflow-projection` ladder: it ranks on `resolved.costPerOutcomeUsd` and its
 * `recommendedWorkflowDynastySlug` is the argmin over MEASURED rows. So a customer
 * reading the table was reading a different question from the one that decided what
 * they are running — which is exactly the complaint ("on ne comprend pas la raison et
 * l'ordre des workflows").
 *
 * ── THE LADDER'S CASCADE, WHICH IS THE WHOLE OF THE "WHY" ────────────────────────
 *
 * Each row carries an estimate at up to three GRAINS — the fleet (`crossOrg`), this
 * brand, and one audience — and a `resolved` pick. Two fields describe that pick and
 * they are DECOUPLED, which is the subtlety this module exists to render honestly:
 *
 *  · `resolved.grain` is a PROVENANCE LABEL: the finest grain that actually OBSERVED
 *    the outcome, else `crossOrg`. A grain that SPENT but observed nothing is a
 *    floored projection, so it is never labelled as this brand's own result.
 *  · `resolved.costBasis` says where the NUMBERS came from: `charged` is this
 *    customer's own billed money (the brand or audience grain), `incurred` is the
 *    fleet benchmark.
 *
 * So `grain: "crossOrg"` + `costBasis: "charged"` is a real and common state, and it
 * means precisely "it ran here, produced none of this outcome, so the price floors at
 * what you spent". Measured in prod on one brand, 24 of 24 rows carried a `crossOrg`
 * label while 7 of them carried a `charged` basis — reading the label alone would have
 * told those 7 customers the figure was somebody else's.
 *
 * ── AN UNMEASURED ROW IS AN OFFER, NEVER A RESULT ────────────────────────────────
 *
 * `measured: false` marks a workflow this channel has measured NOTHING for. Its
 * `resolved.costPerOutcomeUsd` is an EXPLORE ALLOWANCE — the price of ONE OUTREACH,
 * deliberately set so the workflow is reachable and can earn a first run — with no
 * return, no grain and no basis. It is therefore the CHEAPEST row by construction, so
 * it can never be ranked among the measured ones: it sorts after them, and its
 * sentence says the figure is a floor rather than a price.
 *
 * (Every OTHER dashboard surface drops these rows at the reader boundary — see
 * `lib/workflow-projection-measured`. This page is the one surface that needs them,
 * because "this exists and you have not tried it" is an answer a customer picking what
 * to run next wants.)
 *
 * ── WHAT THIS MODULE MAY NOT DO ──────────────────────────────────────────────────
 *
 * It computes NO cost and NO rank of its own: it SORTS on a served figure and reads
 * served evidence into a sentence. Every number a sentence states is one the producer
 * sent. A row the ladder does not carry states no rank and no price at all — "we could
 * not estimate this" and "it costs nothing" are different statements.
 *
 * Alias-free (no `@/` import, no zod) so it carries REAL unit tests — vitest resolves
 * no `@` alias in this repo. Keep it that way.
 */

/** Whose results a resolved figure is labelled as. Null on an unmeasured row. */
export type WorkflowLadderGrain = "crossOrg" | "brand" | "audience";

/** Which accounting question the resolved numbers answer. Null on an unmeasured row. */
export type WorkflowLadderCostBasis = "charged" | "incurred";

/** One grain's observed evidence — the counts a sentence is allowed to state. */
export interface WorkflowLadderEvidence {
  spentUsd: number;
  observedContacted: number;
  observedClicks: number;
  observedPositiveReplies: number;
}

/** One grain's floor-filled unit costs — never null (spend / max(observed, 1)). */
export interface WorkflowLadderUnitCosts {
  costPerClickUsd: number;
  costPerPositiveReplyUsd: number;
  costPerContactedUsd: number;
}

/** One grain of the ladder, as narrowly as this module reads one. */
export interface WorkflowLadderGrainBlock {
  costBasis?: WorkflowLadderCostBasis | null;
  evidence: WorkflowLadderEvidence;
  unitCosts: WorkflowLadderUnitCosts;
  /**
   * The grain's own projected outcome COUNT. Routinely FRACTIONAL on a multi-step
   * funnel (clicks x a conversion rate), which is why no sentence states it as a
   * count of people — the observed evidence above is what a sentence may quote.
   */
  resolvedOutcomeCount?: number | null;
}

/** One ladder row, narrowed to what a rank and a sentence need. */
export interface WorkflowLadderRow {
  workflowDynastySlug: string;
  measured: boolean;
  grain: WorkflowLadderGrain | null;
  costBasis: WorkflowLadderCostBasis | null;
  costPerOutcomeUsd: number | null;
  /** The resolved return, served. Null on an unmeasured row and where economics are absent. */
  roiMultiple: number | null;
  estimatesByGrain: {
    crossOrg?: WorkflowLadderGrainBlock;
    brand?: WorkflowLadderGrainBlock;
    audience?: WorkflowLadderGrainBlock;
  };
}

/**
 * WHICH observed count a sentence may quote, keyed on the step the campaign's leg
 * LANDS ON.
 *
 * A grain's evidence carries exactly three observed counts, and only two of them name
 * an outcome: a click onto the site and a positive reply. Every other step (a signup,
 * a filled form, a booked meeting, a sale) has no observed count at that grain at all,
 * so a sentence about one of those legs quotes the PEOPLE REACHED instead of inventing
 * a number for the outcome. Keyed on the producer's own step key, never on our words.
 */
const OBSERVED_BY_STEP_KEY: Record<string, keyof WorkflowLadderEvidence> = {
  website_visit: "observedClicks",
  conversation: "observedPositiveReplies",
};

/** A row ordered and explained. `rank` is its merit position, 1-based. */
export interface RankedWorkflow<T> {
  row: T;
  /** Position in the MERIT order — the running row keeps its own, it does not become 1. */
  rank: number;
  /** `resolved.costPerOutcomeUsd`, verbatim. Null = the ladder states none. */
  estCostPerOutcomeUsd: number | null;
  /** False for an explore row and for a row the ladder does not carry. */
  measured: boolean;
  /** This is the producer's own pick (`recommendedWorkflowDynastySlug`). */
  recommended: boolean;
  /** One short sentence, built only from served fields. */
  why: string;
  /** The ladder row behind it, for the panel. Null = the ladder does not carry it. */
  ladder: WorkflowLadderRow | null;
}

/**
 * The MERIT tier a row sits in. Lower is better, and the tiers exist because the three
 * kinds of row are not comparable on one number: an explore allowance is cheap by
 * construction, and a row with no estimate at all has nothing to be cheap about.
 */
function meritTier(ladder: WorkflowLadderRow | null): number {
  if (!ladder) return 3;
  if (!ladder.measured) return 2;
  return ladder.costPerOutcomeUsd == null ? 1 : 0;
}

/**
 * A row's OBSERVED count of the leg's outcome at one grain, or null where the grain
 * carries no observed count for that step.
 */
export function observedOutcomeAt(
  grain: WorkflowLadderGrainBlock | undefined,
  outcomeStepKey: string | null | undefined,
): number | null {
  if (!grain) return null;
  const field = outcomeStepKey ? OBSERVED_BY_STEP_KEY[outcomeStepKey] : undefined;
  if (!field) return null;
  const value = grain.evidence[field];
  return typeof value === "number" ? value : null;
}

/** The block a provenance label points at. */
function blockFor(
  ladder: WorkflowLadderRow,
  grain: WorkflowLadderGrain | null,
): WorkflowLadderGrainBlock | undefined {
  if (grain === "audience") return ladder.estimatesByGrain.audience;
  if (grain === "brand") return ladder.estimatesByGrain.brand;
  if (grain === "crossOrg") return ladder.estimatesByGrain.crossOrg;
  return undefined;
}

/** The finest grain this row actually SPENT at — which is where a `charged` figure came from. */
function finestSpentGrain(ladder: WorkflowLadderRow): WorkflowLadderGrain | null {
  if (ladder.estimatesByGrain.audience) return "audience";
  if (ladder.estimatesByGrain.brand) return "brand";
  if (ladder.estimatesByGrain.crossOrg) return "crossOrg";
  return null;
}

export interface WorkflowWhyOptions {
  /** The step the campaign's leg lands on, in the producer's key. */
  outcomeStepKey: string | null;
  /** That step's label, in the customer's words (`Website visit`). */
  outcomeNoun: string;
  /** The producer's own pick. */
  recommended: boolean;
  /** The campaign states it is running this one. */
  running: boolean;
  /** How this app spells a dollar figure — injected so the module stays alias-free. */
  formatUsd: (usd: number) => string;
}

/**
 * ONE SHORT SENTENCE saying why this row sits where it sits.
 *
 * Every clause rests on a served field. Nothing is divided, nothing is guessed, and a
 * figure the producer could not state is simply absent from the sentence rather than
 * rendered as a zero.
 */
export function workflowRankWhy(
  ladder: WorkflowLadderRow | null,
  opts: WorkflowWhyOptions,
): string {
  const lead = opts.running ? "Running now. " : opts.recommended ? "Our pick. " : "";

  if (!ladder) {
    return `${lead}We have no estimate for this one yet, so it is not ranked.`.trim();
  }

  if (!ladder.measured) {
    return ladder.costPerOutcomeUsd == null
      ? `${lead}Never run for you, and we have measured nothing on this channel yet, so there is no price to state.`.trim()
      : `${lead}Never run for you. Priced at one outreach (${opts.formatUsd(
          ladder.costPerOutcomeUsd,
        )}) so it can earn a first try.`.trim();
  }

  const noun = opts.outcomeNoun.toLowerCase();
  const priced =
    ladder.costPerOutcomeUsd == null ? null : opts.formatUsd(ladder.costPerOutcomeUsd);

  // WHOSE results, read off the PROVENANCE label — and the count quoted beside it is
  // that same grain's own observed evidence, so the sentence describes one body of
  // evidence rather than two.
  if (ladder.grain === "audience" || ladder.grain === "brand") {
    const observed = observedOutcomeAt(blockFor(ladder, ladder.grain), opts.outcomeStepKey);
    const whose =
      ladder.grain === "audience" ? "One of your audiences" : "Your own results on this brand";
    const count =
      observed == null ? "" : ` ${observed.toLocaleString("en-US")} ${noun}${observed === 1 ? "" : "s"},`;
    return `${lead}${whose}:${count}${priced ? ` ${priced} each.` : " no price stated."}`.trim();
  }

  // Labelled as the fleet. `charged` means the NUMBERS still came from this customer's
  // own spend — a grain that ran and produced none of this outcome, so the price is
  // floored at what they spent rather than being somebody else's result.
  if (ladder.costBasis === "charged") {
    const spent = blockFor(ladder, finestSpentGrain(ladder))?.evidence.spentUsd ?? null;
    const floor = spent == null ? "" : ` at your ${opts.formatUsd(spent)} of spend`;
    return `${lead}Ran here and produced no ${noun} yet, so the price is floored${floor}.`.trim();
  }

  return `${lead}No ${noun} on this brand yet. Priced on what it does across every client we run it for${
    priced ? `, ${priced} each` : ""
  }.`.trim();
}

export interface RankWorkflowsInput<T> {
  /** The display rows, in any order. */
  rows: readonly T[];
  /** The ladder, brand-level rows only. */
  ladder: readonly WorkflowLadderRow[];
  /** `recommendedWorkflowDynastySlug`, verbatim. */
  recommended: string | null;
  outcomeStepKey: string | null;
  outcomeNoun: string;
  formatUsd: (usd: number) => string;
}

/**
 * THE ONE ORDERING, and it is the producer's.
 *
 * Merit order is ascending `resolved.costPerOutcomeUsd` over MEASURED rows — the exact
 * figure campaign-service ranks on — then the rows with no estimate, then the explore
 * rows (cheap by construction, so never mixed in), then anything the ladder does not
 * carry. Ranks are assigned over THAT order.
 *
 * The row the campaign is RUNNING is then pinned to the top of the DISPLAY list while
 * KEEPING its merit rank, because a reader opening this page wants to see what is
 * happening first and still wants to know where it stands. It is never renumbered to 1:
 * a `#1` badge on a row the producer ranks fourth is the surface stating something the
 * ladder does not.
 *
 * Ties break on the slug so the list is stable across polls.
 */
export function rankWorkflowRows<T extends { workflowDynastySlug: string; running: boolean }>(
  input: RankWorkflowsInput<T>,
): RankedWorkflow<T>[] {
  const byDynasty = new Map<string, WorkflowLadderRow>();
  for (const l of input.ladder) {
    if (!byDynasty.has(l.workflowDynastySlug)) byDynasty.set(l.workflowDynastySlug, l);
  }

  const merit = [...input.rows].sort((a, b) => {
    const la = byDynasty.get(a.workflowDynastySlug) ?? null;
    const lb = byDynasty.get(b.workflowDynastySlug) ?? null;
    const ta = meritTier(la);
    const tb = meritTier(lb);
    if (ta !== tb) return ta - tb;
    const ca = la?.costPerOutcomeUsd;
    const cb = lb?.costPerOutcomeUsd;
    if (ca != null && cb != null && ca !== cb) return ca - cb;
    return a.workflowDynastySlug.localeCompare(b.workflowDynastySlug);
  });

  const ranked = merit.map((row, i) => {
    const ladder = byDynasty.get(row.workflowDynastySlug) ?? null;
    const recommended =
      input.recommended != null && input.recommended === row.workflowDynastySlug;
    return {
      row,
      rank: i + 1,
      estCostPerOutcomeUsd: ladder?.costPerOutcomeUsd ?? null,
      measured: ladder?.measured ?? false,
      recommended,
      why: workflowRankWhy(ladder, {
        outcomeStepKey: input.outcomeStepKey,
        outcomeNoun: input.outcomeNoun,
        recommended,
        running: row.running,
        formatUsd: input.formatUsd,
      }),
      ladder,
    };
  });

  const runningIndex = ranked.findIndex((r) => r.row.running);
  if (runningIndex <= 0) return ranked;
  const [pinned] = ranked.splice(runningIndex, 1);
  return [pinned, ...ranked];
}
