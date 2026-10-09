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
// ── THE OUTBOUND LEG RENAME (wave 2) ───────────────────────────────────────────────────
//
// An outbound leg has two spellings while the backends migrate one by one
// (`start_to_conversation` = `lead_found_to_conversation`, see `outbound-leg-key.ts`).
// Every (channel, leg) map here is keyed on the CANONICAL spelling, and `legFor` finds a
// leg under either spelling, so a key read from a service that has migrated and one read
// from a service that has not name the same leg.
//
// Alias-free on purpose (relative imports only) so it carries REAL unit tests.

import { canonicalLegKey, featureLegId, legKeyTwin, outboundRenameDrift } from "./outbound-leg-key";

/** One step, as the producer names it: its token and the words a customer reads. */
export interface StepDef {
  key: string;
  label: string;
  /** 3 to 5 words a customer reads under the label (features-service `shortDescription`). */
  description?: string;
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
  /** The crew name the producer gives a (channel, leg), keyed `slug|legKey`. Absent = unnamed. */
  crewNames: ReadonlyMap<string, string>;
  /** The CAMPAIGN name (features-service `campaignName`) of a (channel, leg), keyed `featureLegId(slug, legKey)` (canonical spelling). Absent = unnamed. */
  campaignNames: ReadonlyMap<string, string>;
}

export const EMPTY_LEG_CATALOGUE: LegCatalogue = {
  steps: new Map(),
  legs: new Map(),
  legsByChannel: new Map(),
  crewNames: new Map(),
  campaignNames: new Map(),
};

/** The public catalogue body, read structurally: a row missing what this module needs
 *  contributes nothing rather than throwing. */
export interface PublicCatalogueWire {
  steps?: Array<{ key?: unknown; label?: unknown; shortDescription?: unknown }> | null;
  legs?: Array<{
    legKey?: unknown;
    fromStep?: { key?: unknown; label?: unknown } | null;
    toStep?: { key?: unknown; label?: unknown } | null;
  }> | null;
  /** The outbound rename, legacy <-> new (features-service, checked against the locked copy). */
  legKeyCorrespondence?: Array<{ legacyLegKey?: unknown; legKey?: unknown }> | null;
  channels?: Array<{
    slug?: unknown;
    channelType?: unknown;
    stepTransitions?: Array<{
      legKey?: unknown;
      from?: { key?: unknown; label?: unknown } | null;
      to?: { key?: unknown; label?: unknown } | null;
      crewName?: unknown;
      campaignName?: unknown;
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
    const description = str(s?.shortDescription);
    if (key && label && !steps.has(key)) steps.set(key, description ? { key, label, description } : { key, label });
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
  const crewNames = new Map<string, string>();
  const campaignNames = new Map<string, string>();
  const channelTypes = new Map<string, string>();
  for (const channel of body.channels ?? []) {
    const slug = str(channel?.slug);
    if (!slug) continue;
    const type = str(channel?.channelType);
    if (type) channelTypes.set(slug, type);
    const keys: string[] = [];
    for (const t of channel?.stepTransitions ?? []) {
      const servedKey = str(t?.legKey);
      if (!servedKey) continue;
      addLeg(servedKey, t?.from, t?.to);
      const legKey = canonicalLegKey(slug, servedKey);
      if (!keys.includes(legKey)) keys.push(legKey);
      const crew = str(t?.crewName);
      if (crew) crewNames.set(featureLegId(slug, legKey), crew);
      const campaign = str(t?.campaignName);
      if (campaign) campaignNames.set(featureLegId(slug, legKey), campaign);
    }
    legsByChannel.set(slug, keys);
  }
  const drift = outboundRenameDrift(body.legKeyCorrespondence, channelTypes.size > 0 ? channelTypes : null);
  if (drift.length > 0) console.error("[legs] the outbound leg rename drifted from features-service", drift);
  return { steps, legs, legsByChannel, crewNames, campaignNames };
}

/**
 * The teammate name features-service gives the crew performing a (channel, leg), or null
 * when it names none. The producer owns the name, so staff emails and this dashboard
 * say the same one.
 */
export function crewNameFor(
  catalogue: LegCatalogue,
  featureSlug: string | null | undefined,
  legKey: string | null | undefined,
): string | null {
  if (!featureSlug) return null;
  // An older campaign row stating no leg still has a crew when its channel performs one leg.
  const key = legKey ?? (catalogue.legsByChannel.get(featureSlug)?.length === 1 ? catalogue.legsByChannel.get(featureSlug)![0] : null);
  if (!key) return null;
  return catalogue.crewNames.get(featureLegId(featureSlug, key)) ?? null;
}

/** The campaign name features-service gives a (channel, leg), or null when it names none. */
export function campaignNameFor(
  catalogue: LegCatalogue,
  featureSlug: string | null | undefined,
  legKey: string | null | undefined,
): string | null {
  if (!featureSlug || !legKey) return null;
  return catalogue.campaignNames.get(featureLegId(featureSlug, legKey)) ?? null;
}

/** The leg a key names, or null for no key or one the catalogue does not carry. */
export function legFor(catalogue: LegCatalogue, legKey: string | null | undefined): LegDef | null {
  if (!legKey) return null;
  const twin = legKeyTwin(legKey);
  return catalogue.legs.get(legKey) ?? (twin ? catalogue.legs.get(twin) : undefined) ?? null;
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
