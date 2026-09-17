/**
 * THE MODELS THIS CAMPAIGN'S WORKFLOWS WRITE WITH, CHEAPEST FIRST.
 *
 * The campaign Workflows page answers "which WORKFLOW would be picked". A reader of the
 * Overview is asking something coarser and, for a channel whose whole job is writing
 * emails, more useful: which LLM is producing the campaign's outcome for the least money.
 * Several workflows routinely name the same alias (five of this campaign's twenty-two
 * name `pro`), so a list of workflows answers it only by making the reader group them
 * by eye.
 *
 * ── NOTHING HERE RANKS, DIVIDES OR COMPARES A COST ──────────────────────────────────
 *
 * `scopeRank` is the producer's own TOTAL order within one column (1..N, no gaps, no
 * ties), so taking the LOWEST one a model has is reading that order restricted to the
 * rows carrying that alias — the same read `lowestScopePosition` already makes for the
 * grid's per-column highlight. The PRICE shown is then that winning row's own
 * `resolved.costPerOutcomeUsd`, verbatim: the figure and the position come from ONE row,
 * so the list cannot order on a number it is not showing.
 *
 * Deliberately NOT `Math.min` over each model's prices. That would be a comparison of
 * costs taken here, and it could pair a price from one row with a position from another.
 *
 * ── THE ROWS ARE THE CAMPAIGN'S OWN COLUMN, AND THE PAGE'S OWN OFFER ────────────────
 *
 * Only rows with `audienceId === null` — the campaign grain. A per-audience row prices
 * the same workflow for one audience, so folding them in would let one audience's cheap
 * cell speak for the campaign.
 *
 * And the caller passes `hiddenSlugs` (`hiddenWorkflowSlugs`), because the producer's
 * cheapest row can be a workflow this leg's model-tier rule excludes — one campaign-
 * service can never select. A model whose only rows are excluded is a model that cannot
 * write a single email here, and offering it as a top pick would state a price nothing
 * reaches. Same reason the cost curve's floor is taken after that filter.
 *
 * Alias-free (no imports at all) so it carries real unit tests. Keep it that way.
 */

/** The shape this module reads off a ladder row — structural, so the reader owns the type. */
export interface TopModelLadderRow {
  audienceId: string | null;
  workflow: { workflowDynastySlug: string };
  resolved: { costPerOutcomeUsd?: number | null };
  scopeRank?: number | null;
  measured?: boolean;
  modelEligibility?: { modelAlias?: string | null } | null;
}

/** One model, with the position and the price of the row that won it. */
export interface TopModelRow {
  /** The chat-service alias exactly as the workflow states it. */
  alias: string;
  /** The producer's own position of the winning row within the campaign column. */
  scopeRank: number;
  /** That row's own cost per outcome, in dollars. Null when the row states none. */
  costPerOutcomeUsd: number | null;
  /** The dynasty the winning row belongs to — for a `title`, never rendered as a name. */
  workflowDynastySlug: string;
  /** How many of the campaign's workflows name this alias, the winner included. */
  workflowCount: number;
}

/**
 * The campaign's models, ordered by the producer's own position, best first.
 *
 * A row is READ when it is the campaign's own (`audienceId === null`), its dynasty is not
 * hidden, it is `measured`, it states a model alias, and it carries a `scopeRank`. Each
 * of those absences is a reason we cannot place the model, never a reason to place it
 * last: an unplaceable row is dropped so nothing states a position the producer did not.
 *
 * `measured` is required for the same reason every other surface requires it: an
 * unmeasured row's figure is an EXPLORE ALLOWANCE (the price of one outreach, set so an
 * unproven workflow can earn a first run), so it is cheapest by construction and would
 * take the top of this list on no evidence at all.
 */
export function topModels(args: {
  rows: readonly TopModelLadderRow[];
  hiddenSlugs?: ReadonlySet<string>;
  /** How many to return. The card asks for three. */
  limit?: number;
}): TopModelRow[] {
  const hidden = args.hiddenSlugs ?? new Set<string>();
  const best = new Map<string, TopModelRow>();

  for (const row of args.rows) {
    if (row.audienceId !== null) continue;
    if (row.measured !== true) continue;
    const slug = row.workflow.workflowDynastySlug;
    if (hidden.has(slug)) continue;
    const alias = row.modelEligibility?.modelAlias?.trim();
    if (!alias) continue;
    const scopeRank = row.scopeRank;
    if (scopeRank === null || scopeRank === undefined) continue;

    const current = best.get(alias);
    if (current === undefined) {
      best.set(alias, {
        alias,
        scopeRank,
        costPerOutcomeUsd: row.resolved.costPerOutcomeUsd ?? null,
        workflowDynastySlug: slug,
        workflowCount: 1,
      });
      continue;
    }
    // One more workflow naming this alias, whether or not it wins the position.
    current.workflowCount += 1;
    if (scopeRank < current.scopeRank) {
      current.scopeRank = scopeRank;
      // The price travels WITH the position: both come off the row that won.
      current.costPerOutcomeUsd = row.resolved.costPerOutcomeUsd ?? null;
      current.workflowDynastySlug = slug;
    }
  }

  return [...best.values()]
    .sort((a, b) => a.scopeRank - b.scopeRank)
    .slice(0, args.limit ?? 3);
}
