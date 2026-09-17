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
 * The revenue funnels to offer, given the channels picked.
 *
 * Every funnel here ends at a paid client — that is what makes it a REVENUE
 * funnel rather than a step — and it is offered only when a picked channel can
 * actually sell it, so nothing on the screen is unbuyable.
 */
export function funnelsForChannels(channels: CatalogueChannel[]): StartFunnelOption[] {
  const byFunnel = new Map<string, { funnel: CatalogueFunnel; channels: CatalogueChannel[] }>();
  for (const c of channels) {
    for (const f of c.salesFunnels) {
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
