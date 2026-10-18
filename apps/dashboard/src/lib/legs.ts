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
  /** The step in the plural, as a count heading reads it ("Leads", "Positive replies"; features-service `pluralLabel`). */
  pluralLabel?: string;
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

/**
 * One TRIGGER type (features-service `triggers[]`, owner 2026-10-09): the event that runs a
 * REACTIVE leg (a campaign asking for a lead, a positive reply received...). The producer
 * owns the list, its words and its icon token (a Phosphor name); nothing here lists them.
 */
export interface TriggerDef {
  id: string;
  label: string;
  description: string | null;
  /** Phosphor icon name (kebab-case), as served. */
  icon: string | null;
  /** "outcome" (a step reached; its label IS the outcome's label, the UI draws the lightning glyph) or "condition". Null = not served. */
  type: "outcome" | "condition" | null;
  /** The step an outcome trigger fires on; null for a condition or when not served. */
  outcomeKey: string | null;
  /** Whether a campaign can be set off by it; null = not served. */
  callable: boolean | null;
}

/** How a (channel, leg) runs: on its own budget, or on demand when its trigger fires. */
export type LegMode = { mode: "proactive" } | { mode: "reactive"; triggerId: string | null };

/** The catalogue, keyed for lookup. */
export interface LegCatalogue {
  steps: ReadonlyMap<string, StepDef>;
  legs: ReadonlyMap<string, LegDef>;
  /** Every channel's own legs, in the order the producer lists them. */
  legsByChannel: ReadonlyMap<string, readonly string[]>;
  /** The CAMPAIGN name (features-service `campaignName`) of a (channel, leg), keyed `featureLegId(slug, legKey)` (canonical spelling). Absent = unnamed. */
  campaignNames: ReadonlyMap<string, string>;
  /** Proactive or reactive (and its trigger) per (channel, leg), keyed `featureLegId(slug, legKey)`. Absent = not served. */
  modes: ReadonlyMap<string, LegMode>;
  /** Every trigger type, by id, in the producer's order. */
  triggers: ReadonlyMap<string, TriggerDef>;
}

export const EMPTY_LEG_CATALOGUE: LegCatalogue = {
  steps: new Map(),
  legs: new Map(),
  legsByChannel: new Map(),
  campaignNames: new Map(),
  modes: new Map(),
  triggers: new Map(),
};

/** The public catalogue body, read structurally: a row missing what this module needs
 *  contributes nothing rather than throwing. */
export interface PublicCatalogueWire {
  steps?: Array<{ key?: unknown; label?: unknown; shortDescription?: unknown; pluralLabel?: unknown }> | null;
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
      campaignName?: unknown;
      mode?: unknown;
      triggerId?: unknown;
    }> | null;
  }> | null;
  triggers?: Array<{
    id?: unknown;
    label?: unknown;
    description?: unknown;
    icon?: unknown;
    type?: unknown;
    outcomeKey?: unknown;
    callable?: unknown;
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
    const pluralLabel = str(s?.pluralLabel);
    if (key && label && !steps.has(key)) {
      steps.set(key, { key, label, ...(description ? { description } : {}), ...(pluralLabel ? { pluralLabel } : {}) });
    }
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
  const campaignNames = new Map<string, string>();
  const channelTypes = new Map<string, string>();
  const modes = new Map<string, LegMode>();
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
      const campaign = str(t?.campaignName);
      if (campaign) campaignNames.set(featureLegId(slug, legKey), campaign);
      if (t?.mode === "proactive") modes.set(featureLegId(slug, legKey), { mode: "proactive" });
      else if (t?.mode === "reactive") modes.set(featureLegId(slug, legKey), { mode: "reactive", triggerId: str(t?.triggerId) });
    }
    legsByChannel.set(slug, keys);
  }
  const drift = outboundRenameDrift(body.legKeyCorrespondence, channelTypes.size > 0 ? channelTypes : null);
  if (drift.length > 0) console.error("[legs] the outbound leg rename drifted from features-service", drift);
  const triggers = new Map<string, TriggerDef>();
  for (const t of body.triggers ?? []) {
    const id = str(t?.id);
    const label = str(t?.label);
    if (!id || !label || triggers.has(id)) continue;
    const type = t?.type === "outcome" || t?.type === "condition" ? t.type : null;
    const callable = typeof t?.callable === "boolean" ? t.callable : null;
    triggers.set(id, { id, label, description: str(t?.description), icon: str(t?.icon), type, outcomeKey: str(t?.outcomeKey), callable });
  }
  return { steps, legs, legsByChannel, campaignNames, modes, triggers };
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

/**
 * How a campaign (channel x leg) runs, as features-service states it: proactive, or reactive
 * with the trigger that asks for it. Null when the catalogue states no mode for it (not read
 * yet, or a producer older than the mode); the trigger is null when it names none or one
 * `triggers[]` does not carry.
 */
export function campaignModeFor(
  catalogue: LegCatalogue,
  featureSlug: string | null | undefined,
  legKey: string | null | undefined,
): { mode: "proactive" } | { mode: "reactive"; trigger: TriggerDef | null } | null {
  if (!featureSlug || !legKey) return null;
  const m = catalogue.modes.get(featureLegId(featureSlug, canonicalLegKey(featureSlug, legKey)));
  if (!m) return null;
  if (m.mode === "proactive") return m;
  return { mode: "reactive", trigger: m.triggerId ? catalogue.triggers.get(m.triggerId) ?? null : null };
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

const missingPlural = new Set<string>();

/**
 * A step's name in the plural, as features-service serves it (`pluralLabel`: "Leads",
 * "Positive replies", "Meetings booked"). The producer owns the word, so nothing here
 * pluralizes. A step the catalogue carries without a plural is a producer gap: logged
 * once, and the served singular reads instead. While the catalogue has not answered
 * (no steps at all) the singular reads silently.
 */
export function stepPluralLabel(
  catalogue: Pick<LegCatalogue, "steps">,
  stepKey: string | null | undefined,
  singular: string,
): string {
  if (!stepKey) return singular;
  const plural = catalogue.steps.get(stepKey)?.pluralLabel;
  if (plural) return plural;
  if (catalogue.steps.size > 0 && !missingPlural.has(stepKey)) {
    missingPlural.add(stepKey);
    console.error("[legs] features-service serves no pluralLabel for this step", { stepKey, singular });
  }
  return singular;
}
