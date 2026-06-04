// Pipeline-revenue (expected-value) engine for feature revenue overviews.
//
// Pure + dependency-free (NO `@/lib/api` import) so this module is safe in the
// public-report bundle as well as the authed dashboard. Reusable across features:
// the funnel is parameterised (channel → P(paid)); sales is one config built from
// the brand's saved sales-economics.
//
// Model — MAX everywhere, never sum WITHIN an entity:
//   person_EV = max over the person's channels of  LTR × P(paid | channel)
//   org_EV    = max over the org's people of person_EV     (1 org = 1 client = 1 LTR)
//   total     = SUM over DISTINCT orgs of org_EV           (distinct companies add)
// An entity's date is the MOST ADVANCED (max) of its event dates.

/** The 5 sales conversion-economics inputs. Structurally identical to
 *  `BrandSalesEconomics` in `@/lib/api` — re-declared here to keep this module
 *  api-free / report-bundle-safe. Percents are integers 0–100; LTR is whole USD. */
export interface SalesEconomics {
  lifetimeRevenueUsd: number;
  replyToMeetingPct: number;
  visitToMeetingPct: number;
  meetingToClosePct: number;
  visitToClosePct: number;
}

/** A generic funnel: terminal customer value + P(reaching a paid client | signal)
 *  per channel name, each already collapsed to a single 0–1 probability. */
export interface FunnelConfig {
  lifetimeRevenueUsd: number;
  channelProbabilities: Record<string, number>;
}

/** Channel keys the sales-cold-email feature emits. */
export const SALES_CHANNELS = { visit: "visit", reply: "reply" } as const;
export type SalesChannel = (typeof SALES_CHANNELS)[keyof typeof SALES_CHANNELS];

/** Build the sales funnel from a brand's saved economics.
 *  - a visit pays two ways (self-serve close OR via a booked meeting) → take the MAX path;
 *  - a positive reply pays one way (meeting → close). */
export function salesFunnel(e: SalesEconomics): FunnelConfig {
  const pct = (n: number) => n / 100;
  const visitDirect = pct(e.visitToClosePct);
  const visitViaMeeting = pct(e.visitToMeetingPct) * pct(e.meetingToClosePct);
  const reply = pct(e.replyToMeetingPct) * pct(e.meetingToClosePct);
  return {
    lifetimeRevenueUsd: e.lifetimeRevenueUsd,
    channelProbabilities: {
      [SALES_CHANNELS.visit]: Math.max(visitDirect, visitViaMeeting),
      [SALES_CHANNELS.reply]: reply,
    },
  };
}

/** One person's conversion signals within an org. */
export interface PersonSignals {
  personId: string;
  /** Channel names this person triggered, e.g. ["visit", "reply"]. */
  channels: string[];
  /** Most-advanced event ISO date for the person, if known. */
  eventDate?: string | null;
}

/** Expected pipeline revenue for ONE person — MAX across their channels (never sum).
 *  An unconfigured channel is a config/data mismatch: log loud and skip it — no
 *  silent zero-value path, no fallback. */
export function personExpectedRevenueUsd(
  person: PersonSignals,
  cfg: FunnelConfig,
): number {
  let best = 0;
  for (const channel of person.channels) {
    const probability = cfg.channelProbabilities[channel];
    if (probability === undefined) {
      console.error(
        "[revenue] unknown channel — no probability configured, skipping",
        {
          channel,
          personId: person.personId,
          known: Object.keys(cfg.channelProbabilities),
        },
      );
      continue;
    }
    best = Math.max(best, cfg.lifetimeRevenueUsd * probability);
  }
  return best;
}

/** Aggregated, deduplicated conversion for ONE organisation. */
export interface OrgConversion {
  orgId: string;
  /** Max expected revenue across the org's people (dedup — 1 org = 1 client). */
  expectedRevenueUsd: number;
  /** The person carrying the max EV — the most likely to convert. */
  topPersonId: string | null;
  /** Most-advanced event date across the whole org. */
  mostAdvancedDate: string | null;
  /** Union of channels triggered by anyone in the org (multi-tag). */
  channels: string[];
}

/** Roll a list of people up to ONE org row — MAX EV, argmax person, max date, union tags. */
export function orgExpectedRevenue(
  orgId: string,
  people: PersonSignals[],
  cfg: FunnelConfig,
): OrgConversion {
  let expectedRevenueUsd = 0;
  let topPersonId: string | null = null;
  let mostAdvancedDate: string | null = null;
  const channels = new Set<string>();

  for (const person of people) {
    const ev = personExpectedRevenueUsd(person, cfg);
    // Seed on the first person, then keep the strict argmax (ties keep the earlier one).
    if (topPersonId === null || ev > expectedRevenueUsd) {
      expectedRevenueUsd = ev;
      topPersonId = person.personId;
    }
    for (const channel of person.channels) channels.add(channel);
    if (
      person.eventDate &&
      (mostAdvancedDate === null || person.eventDate > mostAdvancedDate)
    ) {
      mostAdvancedDate = person.eventDate;
    }
  }

  return {
    orgId,
    expectedRevenueUsd,
    topPersonId,
    mostAdvancedDate,
    channels: [...channels],
  };
}

/** Total pipeline = SUM of org EVs (distinct companies are additive). */
export function totalPipelineUsd(orgs: OrgConversion[]): number {
  return orgs.reduce((sum, o) => sum + o.expectedRevenueUsd, 0);
}

/** One point on the cumulative revenue-over-time line. */
export interface RevenuePoint {
  date: string;
  cumulativePipelineUsd: number;
}

/** Cumulative pipeline over time. Each earning org contributes its EV at its
 *  most-advanced date; orgs are summed (distinct companies add). Orgs that earn but
 *  carry no date can't be placed on the axis — their pipeline is returned separately
 *  (surfaced, not silently dropped). */
export function cumulativeSeries(orgs: OrgConversion[]): {
  points: RevenuePoint[];
  undatedPipelineUsd: number;
} {
  const earning = orgs.filter((o) => o.expectedRevenueUsd > 0);
  const undatedPipelineUsd = earning
    .filter((o) => !o.mostAdvancedDate)
    .reduce((sum, o) => sum + o.expectedRevenueUsd, 0);

  const sorted = earning
    .filter((o) => o.mostAdvancedDate)
    .sort((a, b) =>
      a.mostAdvancedDate! < b.mostAdvancedDate!
        ? -1
        : a.mostAdvancedDate! > b.mostAdvancedDate!
          ? 1
          : 0,
    );

  let running = 0;
  const points = sorted.map((o) => {
    running += o.expectedRevenueUsd;
    return { date: o.mostAdvancedDate!, cumulativePipelineUsd: running };
  });

  return { points, undatedPipelineUsd };
}
