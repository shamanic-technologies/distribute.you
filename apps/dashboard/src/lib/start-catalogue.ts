// WHAT A VISITOR IS BUYING, derived from the channel catalogue features-service
// publishes — never a local list of our own.
//
// The sell-first onboarding asks TWO narrowing questions before anyone signs up:
// what outcome do you want, and which revenue paths should we run to get it.
// Each answer filters the next, and every path on the second screen is READ off
// `GET /v1/public/channels`. A hardcoded copy is what this file exists to avoid:
// the same copy in `acquisition-channels.ts` went stale listing two channels
// while the producer sold thirty-three.
//
// THERE IS NO CHANNEL QUESTION. We run cold email, so asking a visitor to pick a
// channel is asking them to confirm the only answer there is, and a screen whose
// options do not change the next screen is a screen that costs a conversion for
// nothing. The slug below is the one thing here that is ours rather than the
// producer's, and it is a fact about what we operate, not a preference.
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
 * THE ONE CHANNEL WE RUN THIS THROUGH.
 *
 * Every path a visitor is offered is (funnel x this channel), and the pair key
 * carried through signup still names both halves — the identity billing puts its
 * ceiling on is (offer x funnel x channel), so dropping the channel from the key
 * would change what is bought rather than what is asked.
 *
 * A slug rather than a read because it is a fact about OUR operations: the
 * producer publishes forty-two channels and we do not run forty-one of them.
 */
export const DEFAULT_CHANNEL_SLUG = "sales-cold-email-outreach";

/**
 * The step every funnel ends on. Implicit everywhere: a visitor picking what they
 * want is not also asked to confirm they would like to be paid.
 */
const TERMINAL_STEP_KEY = "paid_client";

/** The step every website funnel starts on, in the producer's own token. */
const WEBSITE_VISIT_STEP_KEY = "website_visit";

/**
 * A BUYER PAYING ON THE WEBSITE, as an outcome a visitor can ask for.
 *
 * DTC and e-commerce sell it directly: nobody signs up, nobody books anything,
 * the buyer arrives and pays. The producer is publishing it as the middle rung of
 * the website-purchase funnel; until that lands the same funnel is published with
 * nothing between the visit and the sale, and `funnelReachesOutcome` reads BOTH
 * shapes (see there). This app names the step in the meantime because the screen
 * offers it; the moment the wire carries it, the wire's own words win.
 */
export const PURCHASE_STEP_KEY = "purchase";

const PURCHASE_FALLBACK: StartOutcome = {
  key: PURCHASE_STEP_KEY,
  // "Direct" is what tells it from a signup: money changes hands at checkout,
  // no account first. Byte-equal with the producer's own words (features-service
  // v0.170.3), so the screen reads the same before and after the wire carries it.
  label: "Direct purchase",
  description: "A buyer pays at checkout on the brand's site, no account needed.",
};

/**
 * THE FOUR THINGS A VISITOR CAN ASK US FOR, owner-fixed, in the order they read.
 *
 * Every published funnel rung used to be offered, which was eight options and
 * three of them nobody buys as an outcome: a website visit and a positive reply
 * are how a funnel STARTS rather than what it is for, an attended meeting is a
 * step of a booked one, and a paid client is where every path ends anyway. What
 * is left is the four a buyer actually wants, and picking one names the paths
 * that reach it with no second question.
 *
 * The first three are the producer's own steps and read its words. The fourth is
 * `purchase`, above.
 */
export const START_OUTCOME_KEYS: readonly string[] = [
  "meeting_booked",
  "signup",
  "form_submitted",
  PURCHASE_STEP_KEY,
];

/** One thing a visitor can ask for. */
export interface StartOutcome {
  /** The step key. Also the identity carried through signup. */
  key: string;
  /** The producer's own wording, where the producer publishes the step. */
  label: string;
  description: string;
}

/** The producer's catalogue, as the two screens read it. */
export interface StartCatalogue {
  channels: CatalogueChannel[];
  funnels: CatalogueFunnelDef[];
  legs: CatalogueLegDef[];
  steps: CatalogueStep[];
}

/**
 * The outcomes to offer: the four above, in that order, in the producer's words.
 *
 * A step the producer has stopped publishing is DROPPED and logged rather than
 * named from memory — we cannot describe a step we no longer read. The one
 * exception is `purchase`, which is named locally on purpose while the producer
 * ships it (see `PURCHASE_STEP_KEY`).
 */
export function startOutcomes(catalogue: StartCatalogue): StartOutcome[] {
  const byKey = new Map(catalogue.steps.map((s) => [s.key, s]));
  const out: StartOutcome[] = [];
  for (const key of START_OUTCOME_KEYS) {
    const step = byKey.get(key);
    if (step) {
      out.push({ key: step.key, label: step.label, description: step.description });
      continue;
    }
    if (key === PURCHASE_STEP_KEY) {
      out.push(PURCHASE_FALLBACK);
      continue;
    }
    console.error(`[start-catalogue] the catalogue publishes no step ${key}; not offering it`);
  }
  return out;
}

/**
 * The channels a selection runs through: the one we operate, and nothing else.
 *
 * Kept under this name and this signature because it is what every reader of a
 * stored selection already calls. The OUTCOMES no longer narrow it — they narrow
 * the funnels, one screen later — so this answers the same question it always
 * did ("what can we run this through") with the answer the product now has.
 *
 * A stored selection's own channel list is deliberately NOT read: a cookie
 * written while the channel screen existed can name channels we never ran for
 * this visitor, and narrowing to the one channel is how those selections keep
 * resolving rather than resolving to nothing.
 */
export function channelsForOutcomes(
  catalogue: StartCatalogue,
  outcomeKeys: string[],
): CatalogueChannel[] {
  if (outcomeKeys.length === 0) return [];
  return catalogue.channels.filter((c) => c.slug === DEFAULT_CHANNEL_SLUG);
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

/** The rungs of a funnel as STEPS (key + the producer's words), in order. */
export function funnelRungs(funnelKey: string, catalogue: StartCatalogue): CatalogueStep[] {
  const byKey = new Map(catalogue.steps.map((s) => [s.key, s]));
  return funnelRungKeys(funnelKey, catalogue).flatMap((key) => {
    const step = byKey.get(key);
    return step ? [step] : [];
  });
}

/**
 * What a funnel CONVERTS: its rungs strictly between the entry and the sale.
 *
 * The entry rung is what the channel DELIVERS and the sale is where every funnel
 * ends, so neither is something a visitor asks us for. What is left is the funnel's
 * own work, and it is what makes one path different from another.
 */
export function funnelInternalRungKeys(funnelKey: string, catalogue: StartCatalogue): string[] {
  return funnelRungKeys(funnelKey, catalogue)
    .slice(1)
    .filter((key) => key !== TERMINAL_STEP_KEY);
}

/**
 * Whether the picked outcomes BUY this funnel.
 *
 * THE RULE, owner-stated: a funnel is offered when a picked outcome is a rung of
 * it strictly between its entry step and the sale. Pick a booked meeting and you
 * are offered both paths that book one; pick a signup and you are offered the one
 * that converts a visit into one. A funnel with nothing between its entry and the
 * sale converts nothing a visitor can name, so it is never offered.
 *
 * It replaced an every-rung rule, which asked a visitor to tick a booked meeting
 * AND a meeting attended before either meeting path appeared — two ticks for one
 * thing anybody would call "get me meetings".
 *
 * THE PURCHASE CASE, and it is temporary by construction. A buyer paying on the
 * website is exactly what the direct visit-to-sale funnel does, and the producer
 * publishes that funnel today with nothing between the two. So a picked purchase
 * matches a funnel whose only rungs are a website visit then the sale — derived
 * from the rungs, never from a funnel key. The moment the producer publishes the
 * purchase rung, that funnel gains an internal rung, the first branch matches it,
 * and the second stops applying to it with nothing to change here.
 */
export function funnelReachesOutcome(
  funnelKey: string,
  outcomeKeys: string[],
  catalogue: StartCatalogue,
): boolean {
  const picked = new Set(outcomeKeys);
  if (funnelInternalRungKeys(funnelKey, catalogue).some((rung) => picked.has(rung))) return true;
  return picked.has(PURCHASE_STEP_KEY) && isDirectWebsiteSale(funnelKey, catalogue);
}

/** A funnel that goes straight from a website visit to the sale, with nothing between. */
function isDirectWebsiteSale(funnelKey: string, catalogue: StartCatalogue): boolean {
  const rungs = funnelRungKeys(funnelKey, catalogue);
  return (
    rungs.length === 2 && rungs[0] === WEBSITE_VISIT_STEP_KEY && rungs[1] === TERMINAL_STEP_KEY
  );
}

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
 * The pairs to offer: one row per (funnel x channel).
 *
 * (offer x funnel x channel) IS a campaign's identity, and it is the key billing puts
 * its ceiling on, so the pair is the thing a visitor actually buys. With one channel
 * that is one row per funnel, and the row reads as the funnel — but the key still
 * names both halves, because what is bought did not change when the question did.
 *
 * Ordered by the producer's own funnel order, then cheapest day rate.
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
