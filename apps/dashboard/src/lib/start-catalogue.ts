// WHAT A VISITOR IS BUYING, derived from the channel catalogue features-service
// publishes — never a local list of our own.
//
// The sell-first onboarding asks three narrowing questions before anyone signs
// up: what outcome do you want, through which channels, and which revenue
// funnels do you want us to run. Each answer filters the next, and every option
// on every screen is READ off `GET /v1/public/channels`. A hardcoded copy is
// what this file exists to avoid: the same copy in `acquisition-channels.ts`
// went stale listing two channels while the producer sold thirty-three, and the
// outcome vocabulary is exactly as prone to it — production publishes FOUR
// entry steps today, and a screen offering the three somebody remembered makes
// every channel behind the fourth unreachable.
//
// Only value imports that carry no "@" alias live here, so this module stays
// directly unit-testable (vitest does not resolve the alias).

/** A step a channel can put a buyer on, in the producer's own words. */
export interface CatalogueStep {
  key: string;
  label: string;
  description: string;
}

/** One leg a channel performs: out of `from` (null = the buyer was not on the
 *  funnel at all) and onto `to`. `legKey` is the fleet's canonical identifier —
 *  never parsed back into its parts. */
export interface CatalogueLeg {
  legKey: string;
  from: CatalogueStep | null;
  to: CatalogueStep;
}

/** A sales funnel as this channel sells it. The minimum run length is already
 *  composed against the channel's own, so a consumer renders
 *  `effectiveMinimumCommitmentDays` and never combines two of our fields. The
 *  same funnel legitimately reads a different figure under another channel. */
export interface CatalogueFunnel {
  key: string;
  name: string;
  steps: readonly string[];
  funnelMinimumCommitmentDays: number | null;
  effectiveMinimumCommitmentDays: number;
  governedBy: string;
}

/**
 * A funnel as the PRODUCER describes it, from the catalogue's own top-level
 * `funnels` list — the entry step included, keyed.
 *
 * This is what makes the funnel screen wire-driven. A funnel's rungs are
 * published as LABELS (`"Positive reply"`), and its label for the step a channel
 * produces is not the step catalogue's label for the same key, so a label join
 * finds nothing; `entryStep.key` is the producer's own answer to "what does this
 * funnel start on" and needs no join at all.
 */
export interface CatalogueLegDef {
  legKey: string;
  /** `null` = onto the funnel from nothing, which is what every entry leg does. */
  fromStep: CatalogueStep | null;
  toStep: CatalogueStep;
  /** Every funnel this arrow belongs to. */
  funnelKeys: string[];
}

export interface CatalogueFunnelDef {
  key: string;
  name: string;
  steps: readonly string[];
  entryStep: CatalogueStep;
  entryLegKey: string;
}

export interface CatalogueChannel {
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
  family: string;
  /** `platform` is us, `customer` is the brand's own team. A customer-operated
   *  channel puts nobody of ours on it, which is what makes its zero day rate a
   *  statement rather than a blank. The converse does not hold — read this for
   *  who is on it, never infer it from the price. */
  operatedBy: string;
  terms: {
    dailyOperatingCostCents: number;
    minimumCommitmentDays: number;
    maxDaysToFirstProduction: number;
  };
  stepTransitions: CatalogueLeg[];
  /** The steps this channel produces FROM NOTHING. A channel that only performs
   *  internal legs of a funnel legitimately produces none. */
  producibleSteps: CatalogueStep[];
  salesFunnels: CatalogueFunnel[];
}

/**
 * AN OUTCOME IS ANY STEP A FUNNEL WE SELL CONTAINS — and what LEADS to it is derived.
 *
 * The screen asks what a visitor wants to buy, and the honest answer set is the
 * funnels' own rungs: a website visit, a positive reply, a signup, a booked meeting,
 * a meeting attended, a filled form, a lead form filled in an ad, a paid client.
 * Every one of those is something somebody wants, and every one of them is reachable.
 *
 * WHAT THIS REPLACED, and why the old shape was right at the time. An outcome used to
 * be a step a channel produces FROM NOTHING, which in production was four options.
 * That was the correct answer to a real problem: the obvious wider reading, "every step
 * a funnel can reach", was measured against production and came back DEGENERATE — six
 * of nine options resolved to the same 31 channels and the same four funnels, because
 * every published funnel started at a website visit or a reply, so every later rung
 * inherited all 31 visit-producing channels. A screen whose options do not change the
 * next screen is six ways of pressing the same button.
 *
 * What changed is the CATALOGUE, not the reasoning. brand-service published four more
 * funnels on 2026-09-17, three of which start somewhere other than a visit or a reply
 * (a booked meeting delivered by an ad, a lead form filled in an ad) and one of which
 * has no rung between the visit and the sale. So the entry sets genuinely differ per
 * outcome now, and the degeneracy the old shape avoided is gone:
 *
 *   Website visit        -> a visit
 *   Signup               -> a visit
 *   Positive reply       -> a reply
 *   Form filled          -> a visit
 *   Lead form submitted  -> a lead form in the ad
 *   Meeting booked       -> a visit, a reply, or a meeting booked in the ad
 *   Meeting attended     -> a visit, a reply, or a meeting booked in the ad
 *   Paid client          -> all four
 *
 * That table is DERIVED, not maintained: it falls out of which funnels contain the
 * step and what each of those funnels starts on. A funnel published upstream updates
 * it with nothing to remember here.
 */
export interface StartOutcome {
  /** The step key. Also the identity carried through signup. */
  key: string;
  /** The producer's own wording. */
  label: string;
  description: string;
  /** Channel slugs that can lead here. Never empty: a step nothing reaches is not an
   *  outcome, so it is never offered. */
  channelSlugs: string[];
}

const uniq = (xs: string[]): string[] => [...new Set(xs)];

/**
 * The funnels that CONTAIN a step, read off the producer's own leg list.
 *
 * By KEY, never by the funnel's `steps`, which the producer states as LABELS — and its
 * label for a rung is not always the step catalogue's label for the same key, so a
 * label join silently finds nothing.
 */
function funnelsContaining(stepKey: string, legs: CatalogueLegDef[]): Set<string> {
  const out = new Set<string>();
  for (const leg of legs) {
    if (leg.fromStep?.key === stepKey || leg.toStep.key === stepKey) {
      for (const key of leg.funnelKeys) out.add(key);
    }
  }
  return out;
}

/**
 * The steps that can LEAD to an outcome: the entry rung of every funnel containing it.
 *
 * A step is among its own entry steps whenever a funnel STARTS on it — which is what
 * makes an ad-delivered booked meeting an outcome you can buy directly as well as one
 * you reach through a visit or a reply. No special case is needed for it.
 */
export function entryStepsFor(outcomeKey: string, catalogue: StartCatalogue): string[] {
  const funnels = funnelsContaining(outcomeKey, catalogue.legs);
  return uniq(
    catalogue.funnels.filter((f) => funnels.has(f.key)).map((f) => f.entryStep.key),
  );
}

/** The producer's catalogue, as the three screens read it. */
export interface StartCatalogue {
  channels: CatalogueChannel[];
  funnels: CatalogueFunnelDef[];
  legs: CatalogueLegDef[];
  steps: CatalogueStep[];
}

/**
 * The outcomes to offer: every step a funnel we sell contains, in funnel order.
 *
 * Ordered by the producer's own step list rather than by how many channels reach each
 * one — the steps read as a journey (a visit, then a signup, then a sale), and sorting
 * them by reach scatters that journey across the screen.
 */
export function startOutcomes(catalogue: StartCatalogue): StartOutcome[] {
  const reachable = new Set(catalogue.legs.flatMap((l) => [l.fromStep?.key, l.toStep.key]));
  const producedBy = new Map<string, string[]>();
  for (const c of catalogue.channels) {
    for (const step of c.producibleSteps) {
      const slugs = producedBy.get(step.key);
      if (slugs) slugs.push(c.slug);
      else producedBy.set(step.key, [c.slug]);
    }
  }

  const out: StartOutcome[] = [];
  for (const step of catalogue.steps) {
    if (!reachable.has(step.key)) continue;
    const channelSlugs = uniq(
      entryStepsFor(step.key, catalogue).flatMap((entry) => producedBy.get(entry) ?? []),
    );
    // A step nothing can reach is not something anybody can buy, so it is not offered
    // rather than offered and then followed by an empty channel screen.
    if (channelSlugs.length === 0) continue;
    out.push({
      key: step.key,
      label: step.label,
      description: step.description,
      channelSlugs,
    });
  }
  return out;
}

/**
 * The channels to offer once outcomes are picked: every channel that can LEAD to any
 * one of them.
 *
 * Union rather than intersection, and deliberately: picking two outcomes says "either
 * of these is worth my money", so a channel serving one of them is worth showing. An
 * intersection would empty the screen for anybody who picked a website visit and a
 * positive reply, which is the most ordinary pair there is.
 *
 * "Can lead to" is the derivation above — a channel producing the ENTRY rung of any
 * funnel that contains the outcome. Matching the outcome against what a channel
 * produces directly would offer nothing for five of the eight outcomes, because no
 * channel delivers a signup, a filled form or a paid client from nothing.
 */
export function channelsForOutcomes(
  catalogue: StartCatalogue,
  outcomeKeys: string[],
): CatalogueChannel[] {
  if (outcomeKeys.length === 0) return [];
  const wanted = new Set(outcomeKeys);
  const allowed = new Set(
    startOutcomes(catalogue)
      .filter((o) => wanted.has(o.key))
      .flatMap((o) => o.channelSlugs),
  );
  return catalogue.channels
    .filter((c) => allowed.has(c.slug))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.slug.localeCompare(b.slug));
}

/** The rungs of a funnel, in order, by the producer's own step keys. */
export function funnelRungKeys(funnelKey: string, catalogue: StartCatalogue): string[] {
  const def = catalogue.funnels.find((f) => f.key === funnelKey);
  if (!def) throw new Error(`[start-catalogue] catalogue describes no funnel ${funnelKey}`);
  const legs = catalogue.legs.filter((l) => l.funnelKeys.includes(funnelKey));
  const next = new Map(legs.map((l) => [l.fromStep?.key ?? "", l.toStep.key]));
  const rungs: string[] = [];
  let at: string | undefined = next.get("");
  // The walk is bounded by the leg count: a catalogue with a cycle would otherwise spin,
  // and a cycle is a producer bug rather than something to render half of.
  while (at && rungs.length <= legs.length) {
    rungs.push(at);
    at = next.get(at);
  }
  return rungs.length > 0 ? rungs : [def.entryStep.key];
}

/**
 * Whether the picked outcomes BUY this funnel.
 *
 * THE RULE, owner-stated: a funnel is offered only when every one of its rungs was
 * picked, with the sale IMPLICIT — every funnel terminates in a paid client, so asking
 * a visitor to tick it is asking them to confirm they want to be paid.
 *
 * It is stricter than "a picked outcome is the step it starts on", which was the rule
 * until the catalogue could express the difference. Under that one, ticking a website
 * visit offered all four website funnels, including Form Magnet to somebody who never
 * asked for a form. Under this one a lone website visit offers exactly `Website
 * Purchase` (visit -> paid client) — which only became possible on 2026-09-17, because
 * until brand-service published that funnel there was no way to sell a visit that goes
 * straight to the sale, and the rule would have emptied the screen for the commonest
 * pick there is.
 */
export function funnelReachesOutcome(
  funnelKey: string,
  outcomeKeys: string[],
  catalogue: StartCatalogue,
): boolean {
  const picked = new Set(outcomeKeys);
  const rungs = funnelRungKeys(funnelKey, catalogue);
  return rungs.every((rung) => rung === TERMINAL_STEP_KEY || picked.has(rung));
}

/**
 * The step every funnel ends on. Implicit at the outcome screen — a visitor ticking the
 * other rungs is not also asked to confirm they would like to be paid.
 */
const TERMINAL_STEP_KEY = "paid_client";

/** One (funnel x channel) pair a visitor can fund: the thing that is actually bought. */
export interface StartFunnelPair {
  /** `<funnelKey>::<channelSlug>` — the identity the selection carries. */
  key: string;
  /** `<Funnel> via <Channel>`: what the row is called, both halves stated. */
  name: string;
  funnelKey: string;
  funnelName: string;
  /** The funnel's rungs in the producer's own words, for the row's second line. */
  steps: readonly string[];
  channelSlug: string;
  channelName: string;
  /** The longest run length for THIS pair, composed by the producer. */
  effectiveMinimumCommitmentDays: number;
  /** What a day of this pair costs. Per PAIR, never summed across a funnel's channels. */
  dailyOperatingCostCents: number;
  /** Who works it: `platform` is us, `customer` is the brand's own team. */
  operatedBy: string;
}

/**
 * The pairs to offer: one row per (funnel x channel), never one row per funnel.
 *
 * (offer x funnel x channel) IS a campaign's identity, and it is the key billing puts
 * its ceiling on, so the pair is the thing a visitor actually buys. The screen used to
 * show one card per funnel with its channels folded inside and the day rate SUMMED
 * across them, which meant ticking "Form Magnet" silently funded every kept channel
 * that sells it. A row per pair makes the purchase explicit and needs no sentence
 * explaining which channels are in it.
 *
 * Ordered by funnel, then cheapest day rate, so a funnel's rows read together and the
 * cheapest way to buy it reads first.
 */
export function funnelsForChannels(
  channels: CatalogueChannel[],
  outcomeKeys: string[],
  catalogue: StartCatalogue,
): StartFunnelPair[] {
  const order = new Map(catalogue.funnels.map((f, i) => [f.key, i]));
  const pairs: StartFunnelPair[] = [];
  for (const c of channels) {
    for (const f of c.salesFunnels) {
      if (!funnelReachesOutcome(f.key, outcomeKeys, catalogue)) continue;
      pairs.push({
        key: startPairKey(f.key, c.slug),
        name: `${f.name} via ${c.name}`,
        funnelKey: f.key,
        funnelName: f.name,
        steps: f.steps,
        channelSlug: c.slug,
        channelName: c.name,
        effectiveMinimumCommitmentDays: f.effectiveMinimumCommitmentDays,
        dailyOperatingCostCents: c.terms.dailyOperatingCostCents,
        operatedBy: c.operatedBy,
      });
    }
  }
  return pairs.sort(
    (a, b) =>
      (order.get(a.funnelKey) ?? 99) - (order.get(b.funnelKey) ?? 99) ||
      a.dailyOperatingCostCents - b.dailyOperatingCostCents ||
      a.channelSlug.localeCompare(b.channelSlug),
  );
}

/**
 * What the picks are SHORT OF, when the kept channels sell funnels but none is bought.
 *
 * The empty screen has a real cause under the every-rung rule, and it is not the one the
 * screen used to state ("no path starts where your channels land"). It is that a path
 * exists and one of its rungs was not ticked — most often a booked meeting without the
 * meeting attended beside it. Naming the nearest gap is the difference between a dead
 * end and one more tick.
 *
 * NEAREST is the funnel missing the FEWEST rungs, so the suggestion is the cheapest way
 * out rather than an arbitrary one. Returns an empty list when the kept channels sell
 * nothing at all, which is a different problem and gets a different sentence.
 */
export function missingRungsForNearestFunnel(
  channels: CatalogueChannel[],
  outcomeKeys: string[],
  catalogue: StartCatalogue,
): CatalogueStep[] {
  const picked = new Set(outcomeKeys);
  const byKey = new Map(catalogue.steps.map((s) => [s.key, s]));
  let best: CatalogueStep[] | null = null;
  for (const c of channels) {
    for (const f of c.salesFunnels) {
      const missing = funnelRungKeys(f.key, catalogue)
        .filter((rung) => rung !== TERMINAL_STEP_KEY && !picked.has(rung))
        .map((rung) => byKey.get(rung))
        .filter((s): s is CatalogueStep => Boolean(s));
      if (missing.length === 0) continue;
      if (!best || missing.length < best.length) best = missing;
    }
  }
  return best ?? [];
}

/** The pairs of one funnel, under that funnel's own name and rungs. */
export interface StartFunnelGroup {
  funnelKey: string;
  funnelName: string;
  steps: readonly string[];
  pairs: StartFunnelPair[];
}

/**
 * The pairs GROUPED by funnel, for a screen that reads as blocks rather than one list.
 *
 * Measured against production: ticking a website visit and a filled form offers 62 rows
 * across two funnels, and the whole catalogue can reach far past that. A row is still
 * one pair — that is the purchase, and it must stay explicit — but the funnel's name and
 * its rungs are stated ONCE above its channels rather than repeated on every card.
 *
 * Order is `funnelsForChannels`'s own, so the cheapest way to buy each funnel still
 * reads first inside its block.
 */
export function funnelGroups(pairs: StartFunnelPair[]): StartFunnelGroup[] {
  const groups: StartFunnelGroup[] = [];
  const byKey = new Map<string, StartFunnelGroup>();
  for (const p of pairs) {
    const existing = byKey.get(p.funnelKey);
    if (existing) {
      existing.pairs.push(p);
      continue;
    }
    const group: StartFunnelGroup = {
      funnelKey: p.funnelKey,
      funnelName: p.funnelName,
      steps: p.steps,
      pairs: [p],
    };
    byKey.set(p.funnelKey, group);
    groups.push(group);
  }
  return groups;
}

/** The identity of one pair, as the selection carries it. */
export function startPairKey(funnelKey: string, channelSlug: string): string {
  return `${funnelKey}::${channelSlug}`;
}

/**
 * The pair keys a stored selection means, tolerant of the FUNNEL-keyed shape.
 *
 * The selection used to name funnels; it names pairs now, and the cookie is NOT
 * version-bumped for it. A bump drops every stored selection, and one of the fields it
 * carries is `paid` — the only record that money was taken between the charge and the
 * brand's creation, because payment happens before there is a brand to attach a budget
 * to. Dropping that would ask somebody to pay twice.
 *
 * A bare funnel key has a defined meaning under the new shape (every pair of that
 * funnel the visitor was offered), so reading it is tolerance rather than a fallback.
 */
export function pairKeysFromSelection(
  stored: string[],
  pairs: { funnelKey: string; channelSlug: string }[],
): string[] {
  const out = new Set<string>();
  for (const entry of stored) {
    if (entry.includes("::")) {
      out.add(entry);
      continue;
    }
    for (const p of pairs) {
      if (p.funnelKey === entry) out.add(startPairKey(p.funnelKey, p.channelSlug));
    }
  }
  return [...out];
}

/** A family of channels, in the producer's own token, with the words a visitor
 *  reads for it. */
export interface ChannelGroup {
  family: string;
  label: string;
  channels: CatalogueChannel[];
}

/**
 * What a visitor reads for each family the producer publishes. An unknown
 * family is not an error: it is grouped under its own token, titlecased, so a
 * family added upstream still renders rather than vanishing from the screen.
 */
const FAMILY_LABEL: Record<string, string> = {
  outbound_one_to_one: "Direct outreach",
  paid_reach: "Ads and sponsorships",
  earned: "Content and press",
  conversion: "Closing the sale",
};

const FAMILY_ORDER = ["outbound_one_to_one", "paid_reach", "earned", "conversion"];

/**
 * The channels grouped by family, in a fixed order, so thirty cards read as
 * four short lists rather than one long one. Order within a group is the
 * producer's own display order, untouched.
 */
export function channelGroups(channels: CatalogueChannel[]): ChannelGroup[] {
  const byFamily = new Map<string, CatalogueChannel[]>();
  for (const c of channels) {
    const list = byFamily.get(c.family);
    if (list) list.push(c);
    else byFamily.set(c.family, [c]);
  }
  const families = [...byFamily.keys()].sort((a, b) => {
    const ia = FAMILY_ORDER.indexOf(a);
    const ib = FAMILY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
  return families.map((family) => ({
    family,
    label:
      FAMILY_LABEL[family] ??
      family.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    channels: byFamily.get(family)!,
  }));
}
