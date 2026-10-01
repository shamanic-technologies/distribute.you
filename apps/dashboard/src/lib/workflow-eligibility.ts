/**
 * WHICH WORKFLOWS THIS PAGE DOES NOT SHOW, AND WHY.
 *
 * Which workflows may run on a leg is a STORED ASSIGNMENT the owner states per (channel,
 * leg, workflow), served by features-service on every leg-keyed ladder row
 * (`legAssignment`: `active` | `deprecated` | `unassigned`). It replaced a rule derived
 * from the model's price tier, which hid workflows that had already run well on a leg.
 * campaign-service picks only `active` rows; this page draws `active` AND `deprecated`
 * ones (a deprecated workflow keeps its history on screen, with a tag) and hides only a
 * workflow that was NEVER put on this leg.
 *
 * ── AN EXCLUDED WORKFLOW THAT HAS ALREADY RUN IS STILL SHOWN ─────────────────────
 *
 * This is the whole reason the producer FLAGS rather than DROPS. The page's rows are the
 * union of what the channel offers and what this campaign has actually spent through, and
 * it already keeps a RETIRED lineage for exactly this reason: dropping it would delete the
 * campaign's own money from the page that exists to show it. A workflow not assigned to
 * this leg is the same case — it may have run for months before the rule existed, and its
 * history is the answer to "what burned money here". So a row is hidden only when it is
 * excluded AND this campaign never spent through it AND the ledger recorded no pick for it.
 *
 * ── "IT RAN HERE" IS THE RESOLVED GRAIN, NEVER `measured` ────────────────────────
 *
 * `measured` says the row rests on REAL SPEND, and the producer's cascade resolves to the
 * narrowest grain that has any — which is `crossOrg` for a workflow this campaign has never
 * touched but the FLEET has. So `measured` is true for nearly every row and reading it as
 * "this ran here" makes the whole rule inert. Measured against prod 2026-09-14 on campaign
 * `f7b1b610…`: all 9 excluded dynasties read `measured: true`, so a `measured`-keyed rule
 * hid ZERO of them; exactly one (`cerulean`) resolved at a campaign grain, and the other
 * eight sat at `crossOrg`. `resolved.grain` is the signal: `campaign` or `audience` is this
 * campaign's own money, `brand` and `crossOrg` are somebody else's.
 *
 * ── AN UNREADABLE LEDGER HIDES NOTHING ──────────────────────────────────────────
 *
 * `observedPicks: null` is features-service saying it could not read the runs ledger, which
 * is different from "this campaign never triggered" (an empty list). With it null we cannot
 * prove a workflow never ran, and hiding is the destructive direction: it removes a row a
 * reader may be looking for. So nothing is hidden at all until the ledger answers.
 *
 * ── THE COUNT IS STATED, BECAUSE THE RANKS GO SPARSE ─────────────────────────────
 *
 * Rows sit at the producer's own `rank`, which this page never re-derives. Hiding rows
 * therefore leaves gaps in the numbers on screen (#1, #2, #5, …), and an unexplained gap
 * reads as a broken table. The note says how many were hidden and what the rule was, so
 * the gap is an answer rather than a defect.
 *
 * Alias-free — its only imports are types, erased at build — so it carries real unit
 * tests. Keep it that way.
 */

/** The producer's verdict for one row. Every field is its own; nothing is derived here. */
export interface RowModelEligibility {
  /** The chat-service alias, or null when the DAG names none. */
  modelAlias?: string | null;
  /** Retiring (the verdict moves to a stored leg assignment); read as a plain string. */
  modelTier?: string | null;
  /** FALSE ⟺ this workflow must not be picked on this leg. */
  eligible: boolean;
  /** Why it is excluded, in the producer's own words. Present ⟺ `eligible` is false. */
  ineligibleReason?: string | null;
  /** Why the tier could not be read. Present ⟺ `modelTier` is null; such a row is eligible. */
  unknownTierReason?: string | null;
}

/** The owner's stored assignment of this workflow to this leg. Every field is the producer's. */
export interface RowLegAssignment {
  /** `active` | `deprecated` | `unassigned`, read as a plain string. */
  state: string;
  /** TRUE ⟺ a new run may pick it on this leg (`active`). */
  selectable: boolean;
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
}

/** ONE LADDER ROW, narrowed to what a hide decision reads. */
export interface EligibilityLadderRow {
  workflow: { workflowDynastySlug: string };
  /** THE GRAIN THE FIGURE CAME FROM — the producer's cascade, narrowest-first. `campaign`
   *  and `audience` are THIS campaign's own spend; `brand` and `crossOrg` are a wider pool
   *  standing in because this campaign has produced nothing through this workflow. */
  resolved: { grain?: string | null };
  /** ABSENT on a goal-keyed body. This page always names a leg, so in practice
   *  it is always there; absent means the producer stated nothing and nothing is hidden. */
  modelEligibility?: RowModelEligibility | null;
  /** ABSENT on a goal-keyed body; absent states no verdict and hides nothing. */
  legAssignment?: RowLegAssignment | null;
}

/** ONE PICK the selector made, narrowed to the dynasty it named. */
export interface EligibilityPick {
  workflowDynastySlug: string;
}

/** The producer's ledger block. NULL ⟺ it could not be read; absent ⟺ not asked for. */
export interface EligibilityObservedPicks {
  last: EligibilityPick | null;
  recent: readonly EligibilityPick[];
}

/**
 * THE DYNASTIES THIS PAGE DOES NOT DRAW.
 *
 * A dynasty is hidden ⟺ EVERY row it has states it was never put on this leg
 * (`unassigned`), NO row of it rests on this campaign's own evidence, and it appears in no
 * recorded pick. Any one of those failing keeps it. A `deprecated` workflow is NEVER hidden.
 */
const OWN_GRAINS = new Set(["campaign", "audience"]);

export function hiddenWorkflowSlugs(args: {
  rows: readonly EligibilityLadderRow[];
  observedPicks: EligibilityObservedPicks | null | undefined;
}): Set<string> {
  const hidden = new Set<string>();
  // An unreadable ledger is not evidence that nothing ran — see the header. Absent is the
  // same posture: the producer stated no picks, so we cannot prove a workflow never ran.
  if (!args.observedPicks) return hidden;

  const ran = new Set<string>();
  if (args.observedPicks.last) ran.add(args.observedPicks.last.workflowDynastySlug);
  for (const p of args.observedPicks.recent) ran.add(p.workflowDynastySlug);

  // Per dynasty: has ANY row that is not `unassigned` (or states no verdict), and has ANY row
  // resolving at a grain that is THIS campaign's own. Both are reasons to keep, so both
  // are collected before deciding.
  const anyEligible = new Set<string>();
  const anyOwnEvidence = new Set<string>();
  const seen = new Set<string>();
  for (const r of args.rows) {
    const slug = r.workflow.workflowDynastySlug;
    seen.add(slug);
    // A row the producer said nothing about is not an exclusion; goal-keyed bodies carry none.
    if (!r.legAssignment || r.legAssignment.state !== "unassigned") anyEligible.add(slug);
    if (OWN_GRAINS.has(r.resolved.grain ?? "")) anyOwnEvidence.add(slug);
  }

  for (const slug of seen) {
    if (anyEligible.has(slug)) continue;
    if (anyOwnEvidence.has(slug)) continue;
    if (ran.has(slug)) continue;
    hidden.add(slug);
  }
  return hidden;
}

/** THE DYNASTIES DEPRECATED ON THIS LEG, drawn with a tag rather than hidden. */
export function deprecatedOnLegSlugs(rows: readonly EligibilityLadderRow[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.legAssignment?.state === "deprecated") out.add(r.workflow.workflowDynastySlug);
  }
  return out;
}

/** The pill a deprecated-on-this-leg row wears, stated once for every surface. */
export const DEPRECATED_ON_LEG_LABEL = "Deprecated on this leg";

/**
 * THE SENTENCE UNDER THE TABLE. Null when nothing was hidden — a line stating zero is
 * noise, and a reader with nothing hidden has no gap to explain.
 *
 * It names the OUTCOME the leg sells (`leg.toStep.label`, the producer's own customer-
 * facing word): the reader picked a campaign, not a model.
 */
export function hiddenWorkflowNote(count: number, outcomeNoun: string | null): string | null {
  if (count <= 0) return null;
  const what = count === 1 ? "1 workflow is" : `${count} workflows are`;
  const sells = outcomeNoun ? ` for ${outcomeNoun.toLowerCase()}` : "";
  return `${what} hidden: never put on this leg${sells}, so never selected to run.`;
}
