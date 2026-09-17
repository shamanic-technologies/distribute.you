/**
 * THE WORKFLOW x AUDIENCE MATRIX — every cell the ranking is scored over, laid out.
 *
 * A customer opening a campaign's Workflows page asks two things: which workflow works
 * best here, and why is the list in THIS order. The table answered neither, and the
 * reason is worth stating exactly, because it is a shape this repo keeps meeting.
 *
 * features-service scores `rank` per DYNASTY over EVERY row that dynasty has — the
 * campaign row AND each per-audience row — while the page displayed ONE row per
 * workflow and one figure per row. So the deciding cell was routinely not the cell on
 * screen: measured in prod on 2026-09-13, rank 1 read $175 above rank 2 at $317 above
 * rank 3 at $21, and the order was in fact perfectly ascending on a series the page
 * never showed (20.35, 20.43, 21.22, 21.48, ...). Nothing was broken and every figure
 * was real; the page was simply displaying one number and ordering on another.
 *
 * The fix is not to re-rank. It is to SHOW THE CELLS — rows are workflows in served
 * `rank` order, columns are the campaign then each audience, and a cell is that
 * (workflow x audience) row's own `resolved.costPerOutcomeUsd`. The argmin then runs
 * over exactly what a reader can see, so `#1` beside a figure that is not the cheapest
 * on its row reads as an audience being in the picture rather than as a bug. Every
 * column then LIGHTS the cell it would pick (`columnBestCells`), so a reader sees which
 * workflow wins whichever audience they end up on.
 *
 * ── WHAT A CELL'S APPEARANCE MEANS ───────────────────────────────────────────────
 *
 * `resolved.grain === "audience"` is the ONLY cell that rests on that audience's own
 * evidence; every other cell is a FLOOR inherited from a coarser grain, which is why
 * one figure repeats down a column. That split is the most useful signal on the grid
 * and it is also the honest state of the evidence: measured in prod, 7 of 312 cells
 * resolved at audience grain and 21 of 24 workflow rows were IDENTICAL across every
 * column. Expect a wall of repeated figures — that is the finding, not a render bug.
 *
 * ── NOTHING HERE ORDERS OR COMPUTES ──────────────────────────────────────────────
 *
 * Row order is the served `rank`. Column order is the served `/audience-stats` order.
 * A cell is a served field, and the cell each column LIGHTS is the lowest `scopeRank`
 * among the rows the page draws — still a read of the producer's own total order, never
 * a ranking taken here. There is deliberately no `.sort(` on a cost anywhere in this
 * module, and no comparison of one cell's figure against another's.
 *
 * Alias-free (no `@/` import, no zod) so it carries REAL unit tests — vitest resolves
 * no `@` alias in this repo. Keep it that way.
 */

/** The column key of the scope that is not an audience: the campaign's own column. */
export const CAMPAIGN_SCOPE = "__campaign__";

/** Whose evidence a cell's figure rests on, in the producer's own vocabulary. */
export type MatrixGrain = "crossOrg" | "brand" | "campaign" | "audience";

/** One ladder row, narrowed to what a matrix needs. */
export interface MatrixLadderRow {
  /** `null` ⟺ the campaign column. */
  audienceId: string | null;
  workflow: { workflowDynastySlug: string };
  resolved: { grain: MatrixGrain | null; costPerOutcomeUsd: number | null };
  measured: boolean;
  /** The WORKFLOW's merit position — identical on every row of one dynasty. */
  rank?: number | null;
  /** This row's position WITHIN its own scope, ordered on its own figure. */
  scopeRank?: number | null;
}

/** One cell of the grid. */
export interface MatrixCell {
  dynastySlug: string;
  /** `null` ⟺ the campaign column. */
  audienceId: string | null;
  costPerOutcomeUsd: number | null;
  grain: MatrixGrain | null;
  measured: boolean;
  scopeRank: number | null;
}

/** One row of the grid: a workflow and the merit rank every one of its cells shares. */
export interface MatrixRow {
  dynastySlug: string;
  rank: number | null;
}

/** The index key for a cell. The campaign column has no id, so it takes a reserved one. */
export function matrixCellKey(dynastySlug: string, audienceId: string | null): string {
  return `${dynastySlug}|${audienceId ?? CAMPAIGN_SCOPE}`;
}

/**
 * Every cell, keyed by (workflow, column). FIRST wins, deterministically — the producer
 * sends one row per pair, so a duplicate is a producer surprise rather than a choice to
 * make here.
 */
export function buildMatrixCellIndex(
  rows: readonly MatrixLadderRow[],
): Map<string, MatrixCell> {
  const out = new Map<string, MatrixCell>();
  for (const r of rows) {
    const key = matrixCellKey(r.workflow.workflowDynastySlug, r.audienceId);
    if (out.has(key)) continue;
    out.set(key, {
      dynastySlug: r.workflow.workflowDynastySlug,
      audienceId: r.audienceId,
      costPerOutcomeUsd: r.resolved.costPerOutcomeUsd,
      grain: r.resolved.grain,
      measured: r.measured,
      scopeRank: r.scopeRank ?? null,
    });
  }
  return out;
}

/**
 * THE ROWS, in the producer's own `rank` order.
 *
 * One entry per dynasty, reading the rank off whichever row of it comes first — every
 * row of a dynasty carries the same number (verified in prod: 0 conflicts over 24
 * dynasties x 13 scopes). A dynasty carrying NO rank sorts after every ranked one and
 * states none, because "we could not rank this" and "it ranks last" are different
 * statements. The slug breaks a tie so the grid is stable across polls.
 *
 * Sorting on `rank` is reading the producer's answer, never deriving one — a page that
 * ranked the rows it DISPLAYS is exactly what produced the second, disagreeing order.
 */
export function matrixWorkflowOrder(rows: readonly MatrixLadderRow[]): MatrixRow[] {
  const byDynasty = new Map<string, number | null>();
  for (const r of rows) {
    const slug = r.workflow.workflowDynastySlug;
    if (byDynasty.has(slug)) continue;
    byDynasty.set(slug, r.rank ?? null);
  }
  return [...byDynasty.entries()]
    .map(([dynastySlug, rank]) => ({ dynastySlug, rank }))
    .sort((a, b) => {
      if (a.rank != null && b.rank != null && a.rank !== b.rank) return a.rank - b.rank;
      if (a.rank != null && b.rank == null) return -1;
      if (a.rank == null && b.rank != null) return 1;
      return a.dynastySlug.localeCompare(b.dynastySlug);
    });
}

/**
 * ONE SCOPE's rows, ordered on the producer's own `scopeRank`.
 *
 * `scopeRank` (features-service v0.164.1) is that row's position among the rows sharing
 * its column, ordered on its OWN figure — so a per-audience list ascends on the number
 * it displays, which `rank` does not. It is a TOTAL order per scope (1..N, no gaps,
 * no ties; verified across all 13 scopes in prod), so this is a read and not a sort on
 * a cost. A row carrying none sorts last and states none.
 */
export function scopeRankedRows(
  rows: readonly MatrixLadderRow[],
  audienceId: string | null,
): MatrixLadderRow[] {
  return rows
    .filter((r) => r.audienceId === audienceId)
    .sort((a, b) => {
      const sa = a.scopeRank ?? null;
      const sb = b.scopeRank ?? null;
      if (sa != null && sb != null && sa !== sb) return sa - sb;
      if (sa != null && sb == null) return -1;
      if (sa == null && sb != null) return 1;
      return a.workflow.workflowDynastySlug.localeCompare(b.workflow.workflowDynastySlug);
    });
}

/**
 * THE POSITION A COLUMN'S ANSWER SITS AT — the lowest `scopeRank` among the rows the
 * page is DRAWING, `null` when none of them carries one.
 *
 * `scopeRank` is a TOTAL order per column (1..N, no gaps, no ties), so reading its
 * minimum over a subset is still reading the producer's order — it is not a ranking
 * taken here, and no figure is compared. The subset matters: `hiddenWorkflowSlugs` has
 * already removed the workflows whose model tier this leg's rule excludes, which are
 * exactly the ones campaign-service refuses to select. Requiring position 1 therefore
 * marks a workflow that can never run, or marks nothing at all.
 *
 * Both surfaces that answer "which workflow would be picked here" read this: the grid's
 * per-column highlight and the per-audience list's own `Current best`. Two copies of the
 * rule is how one page comes to light a cell its own sidebar disagrees with.
 */
export function lowestScopePosition(
  positions: readonly (number | null | undefined)[],
): number | null {
  let best: number | null = null;
  for (const p of positions) {
    if (p === null || p === undefined) continue;
    if (best === null || p < best) best = p;
  }
  return best;
}

/**
 * THE CELL EACH COLUMN WOULD PICK — one per column, read off the producer's own
 * `scopeRank`, among the workflows THIS PAGE OFFERS.
 *
 * The grid used to mark ONE cell: the cheapest measured figure anywhere on it. That
 * answers "where is the best price" and not the question a reader of this page has,
 * which the owner stated outright: *"une case allumee par colonne ... comme ca on
 * comprend quelque soit l'audience choisie quel workflow sera choisi"*. A single mark
 * says nothing about the other twelve columns, and the other twelve columns are the
 * whole reason the matrix exists.
 *
 * `scopeRank` (features-service v0.164.1) is a row's position WITHIN its own column,
 * ascending on that row's own figure, under the same objective and the same groups as
 * `rank`, with never-run workflows always last. It is a TOTAL order per column — 1..N,
 * no gaps, no ties — so the LOWEST position present is the column's answer. Nothing is
 * computed, compared or sorted below; this reads a field.
 *
 * ── WHY THE LOWEST PRESENT, AND NOT `=== 1` ─────────────────────────────────────
 *
 * The rows reaching this function are the ones the page DRAWS: `hiddenWorkflowSlugs`
 * has already removed the workflows whose model tier this leg's rule excludes. Those
 * are exactly the workflows campaign-service refuses to select (it drops the same rows
 * before its own argmin), so a mark on `scopeRank === 1` lights a workflow that can
 * NEVER run — and, far more often, lights nothing at all, because the producer ranks on
 * price and the cheap tier is cheapest.
 *
 * Measured in prod on 2026-09-17 (campaign `3922c8e1…`, a leg selling a conversation):
 * `maelstrom` is `scopeRank === 1` in 14 of 16 columns and is excluded by the tier rule,
 * so 14 columns lit NOTHING and the two that did were an accident of the exclusion. The
 * footer promises "the highlighted cell in each column is the workflow we would put that
 * audience on"; reading the lowest OFFERED position is what makes that sentence true.
 *
 * ⚠️ It is still the COLUMN's answer, never the campaign's. The campaign-wide pick is
 * `rank` (and `recommendedWorkflowDynastySlug`), which is scored across every column at
 * once — so the lit cells and the `#1` row legitimately disagree, and in prod they do. A
 * column whose lit cell sits on row 7 is telling you something true.
 */
export function columnBestCells(
  rows: readonly MatrixLadderRow[],
): Map<string, string> {
  // Group each column's rows, then read the position off the SAME helper the
  // per-audience list uses — two copies of the rule is how one page comes to light a
  // cell its own sidebar disagrees with.
  const byColumn = new Map<string, MatrixLadderRow[]>();
  for (const r of rows) {
    const column = r.audienceId ?? CAMPAIGN_SCOPE;
    const held = byColumn.get(column);
    if (held) held.push(r);
    else byColumn.set(column, [r]);
  }

  const out = new Map<string, string>();
  for (const [column, columnRows] of byColumn) {
    const position = lowestScopePosition(columnRows.map((r) => r.scopeRank));
    // A column the producer placed no positioned row in states nothing, so it lights
    // nothing: a fabricated winner is worse than an unlit column.
    if (position === null) continue;
    // The producer states a TOTAL order per column, so a second row at the same
    // position is a producer surprise rather than a choice to make here. Keeping the
    // lowest slug makes it deterministic, so the mark cannot move between two polls of
    // the same data.
    let slug: string | null = null;
    for (const r of columnRows) {
      if (r.scopeRank !== position) continue;
      const candidate = r.workflow.workflowDynastySlug;
      if (slug === null || candidate.localeCompare(slug) < 0) slug = candidate;
    }
    if (slug !== null) out.set(column, slug);
  }
  return out;
}

/** Is this cell the one its own column would pick? */
export function isColumnBestCell(
  columnBest: Map<string, string>,
  dynastySlug: string,
  audienceId: string | null,
): boolean {
  return columnBest.get(audienceId ?? CAMPAIGN_SCOPE) === dynastySlug;
}

/**
 * Does this cell rest on the COLUMN's own evidence, or is it a floor inherited from a
 * coarser grain?
 *
 * The one visual distinction the grid makes, and the whole reason the wall of repeated
 * figures is legible: `audience` marks a cell the audience itself produced, `campaign`
 * marks one the campaign column produced. Everything else repeated down from the brand
 * or the fleet.
 */
export function cellRestsOnOwnEvidence(cell: MatrixCell | undefined): boolean {
  if (!cell) return false;
  if (cell.audienceId === null) return cell.grain === "campaign";
  return cell.grain === "audience";
}
