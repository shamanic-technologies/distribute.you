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

import { SALES_FUNNELS, normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "./sales-funnels";

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
 * AN OUTCOME IS WHAT A CHANNEL DELIVERS FROM NOTHING — the entry step you buy.
 *
 * The obvious wider reading, and the one measured against production before it
 * was built, is "every step a funnel can reach": produce the rung directly, or
 * produce a rung the funnel reaches it from. That derivation is correct and
 * DEGENERATE. Over the 42 published channels it yields nine options of which
 * SIX are identical — Website visit, Signup, Form filled, Meeting booked,
 * Meeting attended and Paid client all resolve to the same 31 channels and the
 * same four funnels, because every funnel starts at a website visit or a reply,
 * so every later rung inherits all 31 visit-producing channels. A screen whose
 * options do not change the next screen is not a filter; it is six ways of
 * pressing the same button.
 *
 * So an outcome is a step some channel produces FROM NOTHING. In production that
 * is four options with real spread — a website visit (31 channels), a
 * conversation (14), a form filled inside the ad (8), a meeting booked straight
 * from the ad (2) — and each one genuinely narrows what comes next.
 *
 * WHERE THE MEETING UNION WENT. No channel anywhere produces the funnel's own
 * `meeting_booked` from nothing: a meeting is reached THROUGH a visit or a
 * conversation. So "I want booked meetings" is not an entry step at all, it is a
 * FUNNEL, and it is asked two screens later — where picking the meeting funnel
 * already unions across every channel the visitor kept. Asking it here as a
 * fourth entry option is exactly what produced the six-way tie.
 */
export interface StartOutcome {
  /** The step key. Also the identity carried through signup. */
  key: string;
  /** The producer's own wording. */
  label: string;
  description: string;
  /** Channel slugs that produce it. Never empty: a step nothing produces is not
   *  an outcome, so it is never offered. */
  channelSlugs: string[];
}

const uniq = (xs: string[]): string[] => [...new Set(xs)];

/**
 * The outcomes to offer, derived end to end from the catalogue.
 *
 * Widest first: the screen is a narrowing question, so the option leaving the
 * most room to pick from reads first. Ties fall back to the key, so the order is
 * stable between reads rather than moving under the visitor.
 */
export function startOutcomes(channels: CatalogueChannel[]): StartOutcome[] {
  const byKey = new Map<string, { step: CatalogueStep; slugs: string[] }>();
  for (const c of channels) {
    for (const step of c.producibleSteps) {
      const entry = byKey.get(step.key);
      if (entry) entry.slugs.push(c.slug);
      else byKey.set(step.key, { step, slugs: [c.slug] });
    }
  }

  return [...byKey.values()]
    .map(({ step, slugs }) => ({
      key: step.key,
      label: step.label,
      description: step.description,
      channelSlugs: uniq(slugs),
    }))
    .sort((a, b) => b.channelSlugs.length - a.channelSlugs.length || a.key.localeCompare(b.key));
}

/**
 * The channels to offer once outcomes are picked: the union of every picked
 * outcome's own set.
 *
 * Union rather than intersection, and deliberately: picking two outcomes says
 * "either of these is worth my money", so a channel serving one of them is a
 * channel worth showing. An intersection would empty the screen for anybody who
 * picked a website visit and a conversation, which is the most ordinary pair
 * there is.
 */
export function channelsForOutcomes(
  channels: CatalogueChannel[],
  outcomeKeys: string[],
): CatalogueChannel[] {
  if (outcomeKeys.length === 0) return [];
  const wanted = new Set(outcomeKeys);
  const allowed = new Set(
    startOutcomes(channels)
      .filter((o) => wanted.has(o.key))
      .flatMap((o) => o.channelSlugs),
  );
  return channels
    .filter((c) => allowed.has(c.slug))
    .sort((a, b) => a.displayOrder - b.displayOrder || a.slug.localeCompare(b.slug));
}

/** A funnel offered to the visitor, with the channels of theirs that sell it. */
export interface StartFunnelOption {
  key: string;
  name: string;
  steps: readonly string[];
  /** Their picked channels that can sell this funnel, cheapest day rate first. */
  channelSlugs: string[];
  /** The longest run length across those channels — the figure that answers
   *  "how long before I can judge this" for the pair they will actually buy.
   *  Composed by the producer per pair; never combined here. */
  effectiveMinimumCommitmentDays: number;
  /** What a day costs across those channels, summed: funding a funnel funds
   *  every channel picked for it. */
  dailyOperatingCostCents: number;
}

/**
 * Where an in-ad outcome LANDS on a funnel.
 *
 * The two in-ad entry steps start no published funnel: a form filled inside the
 * ad is the funnel's "Form filled" rung reached without the website visit before
 * it, and a meeting booked from the ad is the "Meeting booked" rung reached the
 * same way. So a visitor who wants those is offered the funnels that CONTAIN the
 * rung they land on. Keyed on the producer's own step tokens; a step absent from
 * here is an entry step in its own right and matches only a funnel that starts
 * on it.
 */
const IN_AD_LANDS_ON: Record<string, string> = {
  in_ad_form_submission: "form_filled",
  in_ad_booked_meeting: "meeting_booked",
};

/**
 * Whether a funnel is one the picked outcomes lead INTO.
 *
 * THE FILTER THE FUNNEL SCREEN IS FOR. A channel sells several funnels, and most
 * sell every funnel that starts on any step it produces: cold email produces a
 * conversation AND a website visit, so it sells the reply funnel and the three
 * website funnels alike. Offering a channel's whole list therefore ignores the
 * outcome the visitor just picked — pick "a conversation", keep cold email, and
 * the screen offered "Website Purchase", a funnel that starts on a step they
 * never asked for. A funnel is offered only when a picked outcome is the step it
 * starts on (or, for an in-ad outcome, a rung it contains).
 *
 * The funnel's rungs come from this app's own catalogue rather than the wire:
 * the producer states a funnel's steps as LABELS, and its label for the reply
 * funnel's first rung ("Positive reply") is not its label for the step a channel
 * produces ("Conversation"), so a label join finds nothing. A wire key this
 * app's catalogue cannot name is a vocabulary drift and THROWS, per
 * `normalizeSalesFunnelKey`.
 */
export function funnelReachesOutcome(funnelKey: string, outcomeKeys: string[]): boolean {
  const local = normalizeSalesFunnelKey(funnelKey as SalesFunnelKeyWire);
  const def = SALES_FUNNELS.find((f) => f.key === local);
  if (!def) throw new Error(`[start-catalogue] no local funnel for ${funnelKey}`);
  const rungs: readonly string[] = def.stepKeys;
  return outcomeKeys.some((k) => {
    const landsOn = IN_AD_LANDS_ON[k];
    return landsOn ? rungs.includes(landsOn) : rungs[0] === k;
  });
}

/**
 * The revenue funnels to offer, given the channels picked AND the outcomes those
 * channels were picked for.
 *
 * Every funnel here ends at a paid client — that is what makes it a REVENUE
 * funnel rather than a step — and it is offered only when a picked channel can
 * actually sell it AND a picked outcome leads into it, so nothing on the screen
 * is unbuyable and nothing on it starts somewhere the visitor did not ask for.
 */
export function funnelsForChannels(
  channels: CatalogueChannel[],
  outcomeKeys: string[],
): StartFunnelOption[] {
  const byFunnel = new Map<string, { funnel: CatalogueFunnel; channels: CatalogueChannel[] }>();
  for (const c of channels) {
    for (const f of c.salesFunnels) {
      if (!funnelReachesOutcome(f.key, outcomeKeys)) continue;
      const entry = byFunnel.get(f.key);
      if (entry) entry.channels.push(c);
      else byFunnel.set(f.key, { funnel: f, channels: [c] });
    }
  }

  return [...byFunnel.values()]
    .map(({ funnel, channels: sellers }) => {
      const ordered = [...sellers].sort(
        (a, b) =>
          a.terms.dailyOperatingCostCents - b.terms.dailyOperatingCostCents ||
          a.slug.localeCompare(b.slug),
      );
      // The longest of the pair figures, because the slowest channel is what
      // decides when the funnel as a whole is judgeable.
      const commitment = Math.max(
        ...sellers.map((c) => {
          const f = c.salesFunnels.find((x) => x.key === funnel.key);
          return f ? f.effectiveMinimumCommitmentDays : 0;
        }),
      );
      return {
        key: funnel.key,
        name: funnel.name,
        steps: funnel.steps,
        channelSlugs: ordered.map((c) => c.slug),
        effectiveMinimumCommitmentDays: commitment,
        dailyOperatingCostCents: ordered.reduce(
          (sum, c) => sum + c.terms.dailyOperatingCostCents,
          0,
        ),
      };
    })
    .sort((a, b) => b.channelSlugs.length - a.channelSlugs.length || a.key.localeCompare(b.key));
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
