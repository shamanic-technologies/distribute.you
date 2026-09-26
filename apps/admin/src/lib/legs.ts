// STEPS and LEGS, as the platform names them.
//
// A STEP is a node a lead reaches (Positive reply, Website visit, Meeting booked,
// Paid client). A LEG moves a lead from one step to another; an ENTRY leg puts a lead
// on a step from nothing (`fromKey: null`). A CHANNEL performs legs, and a campaign is
// (offer x leg x channel). An OUTCOME is a step one of our channels lands a leg on.
//
// features-service is the one authority on all of it and publishes it on the public,
// org-less catalogue (`GET /public/channels`): every step with its label, every leg
// with its canonical `legKey` and the two steps it connects, and every channel with
// the legs it performs. This module READS that catalogue and keeps no copy of it, so a
// leg published upstream is nameable here the moment it is published.
//
// ── THE LEG KEY IS OPAQUE ─────────────────────────────────────────────────────────────
//
// `legKey` is minted by features-service. It is readable (`conversation_to_meeting_booked`)
// so a human can recognise it in a log, and that readability is the trap: a consumer
// that splits it re-couples itself to a spelling the producer owns. So a leg is always
// LOOKED UP in the catalogue served beside it, never taken apart.
//
// Alias-free on purpose (no runtime import at all) so it carries REAL unit tests.

/** One step, as the producer names it: its token and the words a customer reads. */
export interface StepDef {
  key: string;
  label: string;
}

/** One leg, with both of its steps resolved. `fromKey` is null for an entry leg. */
export interface LegDef {
  legKey: string;
  fromKey: string | null;
  toKey: string;
  fromLabel: string | null;
  toLabel: string;
  /** What a customer reads for this leg: the step an entry leg lands on, else "A → B". */
  label: string;
}

/** The catalogue, keyed for lookup. */
export interface LegCatalogue {
  steps: ReadonlyMap<string, StepDef>;
  legs: ReadonlyMap<string, LegDef>;
  /** Every channel's own legs, in the order the producer lists them. */
  legsByChannel: ReadonlyMap<string, readonly string[]>;
}

export const EMPTY_LEG_CATALOGUE: LegCatalogue = {
  steps: new Map(),
  legs: new Map(),
  legsByChannel: new Map(),
};

/** The public catalogue body, read structurally: a row missing what this module needs
 *  contributes nothing rather than throwing. */
export interface PublicCatalogueWire {
  steps?: Array<{ key?: unknown; label?: unknown }> | null;
  legs?: Array<{
    legKey?: unknown;
    fromStep?: { key?: unknown; label?: unknown } | null;
    toStep?: { key?: unknown; label?: unknown } | null;
  }> | null;
  channels?: Array<{
    slug?: unknown;
    stepTransitions?: Array<{
      legKey?: unknown;
      from?: { key?: unknown; label?: unknown } | null;
      to?: { key?: unknown; label?: unknown } | null;
    }> | null;
  }> | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** "Positive reply" for an entry leg, "Positive reply → Meeting booked" otherwise. */
export function legLabelFor(fromLabel: string | null, toLabel: string): string {
  return fromLabel ? `${fromLabel} → ${toLabel}` : toLabel;
}

/**
 * Build the catalogue from the published body.
 *
 * The top-level `legs` is the authority; a leg only a channel states (a producer older
 * than the top-level list) is still indexed from the channel's own transitions, so the
 * lookup never loses a leg a campaign can carry.
 */
export function legCatalogueFromWire(body: PublicCatalogueWire | null | undefined): LegCatalogue {
  if (!body) return EMPTY_LEG_CATALOGUE;
  const steps = new Map<string, StepDef>();
  for (const s of body.steps ?? []) {
    const key = str(s?.key);
    const label = str(s?.label);
    if (key && label && !steps.has(key)) steps.set(key, { key, label });
  }
  const labelOf = (key: string | null, served: unknown): string | null => {
    if (!key) return null;
    return str(served) ?? steps.get(key)?.label ?? key;
  };

  const legs = new Map<string, LegDef>();
  const addLeg = (
    legKey: string | null,
    from: { key?: unknown; label?: unknown } | null | undefined,
    to: { key?: unknown; label?: unknown } | null | undefined,
  ) => {
    const toKey = str(to?.key);
    if (!legKey || !toKey || legs.has(legKey)) return;
    const fromKey = str(from?.key);
    const fromLabel = labelOf(fromKey, from?.label);
    const toLabel = labelOf(toKey, to?.label) ?? toKey;
    legs.set(legKey, { legKey, fromKey, toKey, fromLabel, toLabel, label: legLabelFor(fromLabel, toLabel) });
  };
  for (const leg of body.legs ?? []) addLeg(str(leg?.legKey), leg?.fromStep, leg?.toStep);

  const legsByChannel = new Map<string, string[]>();
  for (const channel of body.channels ?? []) {
    const slug = str(channel?.slug);
    if (!slug) continue;
    const keys: string[] = [];
    for (const t of channel?.stepTransitions ?? []) {
      const legKey = str(t?.legKey);
      if (!legKey) continue;
      addLeg(legKey, t?.from, t?.to);
      if (!keys.includes(legKey)) keys.push(legKey);
    }
    legsByChannel.set(slug, keys);
  }
  return { steps, legs, legsByChannel };
}

/** The leg a key names, or null for no key or one the catalogue does not carry. */
export function legFor(catalogue: LegCatalogue, legKey: string | null | undefined): LegDef | null {
  if (!legKey) return null;
  return catalogue.legs.get(legKey) ?? null;
}

/** The legs a channel performs, resolved. Empty for a channel the catalogue misses. */
export function channelLegs(catalogue: LegCatalogue, featureSlug: string | null | undefined): LegDef[] {
  if (!featureSlug) return [];
  return (catalogue.legsByChannel.get(featureSlug) ?? [])
    .map((key) => catalogue.legs.get(key))
    .filter((leg): leg is LegDef => leg !== undefined);
}

/**
 * The leg identified by the two steps it connects — the inverse lookup, for a surface
 * that knows which move it is buying and must state it the way the fleet keys it.
 * Reading the key out of the catalogue rather than minting it is the whole point.
 */
export function legKeyForSteps(
  catalogue: LegCatalogue,
  fromKey: string | null,
  toKey: string,
): string | null {
  for (const leg of catalogue.legs.values()) {
    if (leg.toKey === toKey && leg.fromKey === fromKey) return leg.legKey;
  }
  return null;
}

/** The customer's word for a step, or null for a step the catalogue does not carry. */
export function stepLabel(catalogue: LegCatalogue, stepKey: string | null | undefined): string | null {
  if (!stepKey) return null;
  return catalogue.steps.get(stepKey)?.label ?? null;
}
