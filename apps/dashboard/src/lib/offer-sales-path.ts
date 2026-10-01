/**
 * How an offer sells: the STEPS a sale goes through and the LEGS between them,
 * as the customer ticks them on the offer page (beta). Pure rules only, no imports,
 * so they carry real unit tests.
 *
 * The step and leg vocabulary is features-service's (the public catalogue); this
 * module only decides how a tick on one card moves the others:
 *
 *  - Ticking a LEG ticks the steps it connects. Unticking it drops every step no
 *    remaining ticked leg still touches.
 *  - Ticking a STEP ticks every leg that joins it to a step already ticked (or to
 *    the start, or to the paying client). Unticking it drops it and its legs.
 *
 * `paid_client` is where every path ends, so it is always there and is not a card.
 * An ENTRY leg (from nothing) is offered only when one of the channels we run
 * performs it: a lead cannot enter a path nobody brings it into. A leg between two
 * steps is offered whether or not a channel performs it, because a person (the
 * brand's sales rep) can.
 */

export const TERMINAL_STEP = "paid_client";

/**
 * The channels this surface offers, and the only ones: what we run today. A leg no
 * channel of these performs is worked by the brand's own team.
 */
export const SALES_PATH_CHANNEL_SLUGS = [
  "sales-cold-email-outreach",
  "ai-meeting-booking",
  "ai-instant-call",
] as const;

export interface PathLeg {
  legKey: string;
  /** null for an entry leg: the lead was on no step before it. */
  fromKey: string | null;
  toKey: string;
}

export interface SalesPathSelection {
  steps: ReadonlySet<string>;
  legs: ReadonlySet<string>;
}

export const EMPTY_SELECTION: SalesPathSelection = { steps: new Set(), legs: new Set() };

/** The legs the page offers: every leg between steps, and the entry legs a channel of ours performs. */
export function offeredLegs(
  legs: readonly PathLeg[],
  channelsByLeg: ReadonlyMap<string, readonly string[]>,
): PathLeg[] {
  return legs.filter((l) => l.fromKey !== null || (channelsByLeg.get(l.legKey)?.length ?? 0) > 0);
}

/** The steps offered as cards: every step an offered leg touches, except the paying client. */
export function offeredSteps(legs: readonly PathLeg[], stepOrder: readonly string[]): string[] {
  const touched = new Set<string>();
  for (const l of legs) {
    if (l.fromKey) touched.add(l.fromKey);
    touched.add(l.toKey);
  }
  touched.delete(TERMINAL_STEP);
  return stepOrder.filter((s) => touched.has(s));
}

/** A step a path can always reach without ticking it: the start and the paying client. */
function isImplicit(step: string | null): boolean {
  return step === null || step === TERMINAL_STEP;
}

function stepsOf(leg: PathLeg): string[] {
  return [leg.fromKey, leg.toKey].filter((s): s is string => !isImplicit(s));
}

export function toggleLeg(
  sel: SalesPathSelection,
  leg: PathLeg,
  on: boolean,
  legs: readonly PathLeg[],
): SalesPathSelection {
  const nextLegs = new Set(sel.legs);
  const nextSteps = new Set(sel.steps);
  if (on) {
    nextLegs.add(leg.legKey);
    for (const s of stepsOf(leg)) nextSteps.add(s);
    return { steps: nextSteps, legs: nextLegs };
  }
  nextLegs.delete(leg.legKey);
  const stillTouched = new Set<string>();
  for (const l of legs) if (nextLegs.has(l.legKey)) for (const s of stepsOf(l)) stillTouched.add(s);
  for (const s of stepsOf(leg)) if (!stillTouched.has(s)) nextSteps.delete(s);
  return { steps: nextSteps, legs: nextLegs };
}

export function toggleStep(
  sel: SalesPathSelection,
  step: string,
  on: boolean,
  legs: readonly PathLeg[],
): SalesPathSelection {
  const nextSteps = new Set(sel.steps);
  const nextLegs = new Set(sel.legs);
  const touches = (l: PathLeg) => l.fromKey === step || l.toKey === step;
  if (on) {
    nextSteps.add(step);
    const reachable = (s: string | null) => isImplicit(s) || nextSteps.has(s as string);
    for (const l of legs) if (touches(l) && reachable(l.fromKey) && reachable(l.toKey)) nextLegs.add(l.legKey);
    return { steps: nextSteps, legs: nextLegs };
  }
  nextSteps.delete(step);
  for (const l of legs) if (touches(l)) nextLegs.delete(l.legKey);
  return { steps: nextSteps, legs: nextLegs };
}

/**
 * The legs and steps a surface offers, off the catalogue: every leg between steps, the
 * entry legs a channel of ours performs, and the steps they touch (in catalogue order).
 * `channelsByLeg` lists, per leg, the channels of ours that perform it.
 */
export function offeredFromCatalogue(
  catalogue: {
    legs: ReadonlyMap<string, { legKey: string; fromKey: string | null; toKey: string }>;
    steps: ReadonlyMap<string, unknown>;
    legsByChannel: ReadonlyMap<string, readonly string[]>;
  },
  channelSlugs: Iterable<string>,
): { legs: PathLeg[]; steps: string[]; channelsByLeg: Map<string, string[]> } {
  const ours = new Set(channelSlugs);
  const byLeg = new Map<string, string[]>();
  for (const [slug, keys] of catalogue.legsByChannel) {
    if (!ours.has(slug)) continue;
    for (const k of keys) byLeg.set(k, [...(byLeg.get(k) ?? []), slug]);
  }
  const all: PathLeg[] = [...catalogue.legs.values()].map((l) => ({ legKey: l.legKey, fromKey: l.fromKey, toKey: l.toKey }));
  const offered = offeredLegs(all, byLeg);
  return { legs: offered, steps: offeredSteps(offered, [...catalogue.steps.keys()]), channelsByLeg: byLeg };
}

/** A selection built by ticking steps one by one (the legs between ticked steps follow). */
export function selectionFromSteps(stepKeys: readonly string[], legs: readonly PathLeg[]): SalesPathSelection {
  let sel: SalesPathSelection = { steps: new Set(), legs: new Set() };
  for (const s of stepKeys) sel = toggleStep(sel, s, true, legs);
  return sel;
}
