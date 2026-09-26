// The least a funded daily ceiling may be stated at, READ from the acquisition
// channel's own published commercial terms.
//
// WHAT DECIDES A FLOOR. A campaign is (offer x leg x acquisition channel), and
// what a day of it costs is a property of the CHANNEL: cold email costs what cold
// email costs, whoever runs it and whatever leg it performs.
//
// WHERE THE FIGURE LIVES. features-service publishes every channel's commercial
// terms on `GET /public/channels`, `terms.dailyOperatingCostCents` among them.
// That IS the floor, and it is read from there rather than copied into a table
// here: a local copy of another service's product figure goes stale silently, and
// the one that used to live here did, refusing money billing would have taken.
//
// WHAT DECIDES, FULL STOP. billing-service. It holds the same rule against the
// same published figure and its 400 is the answer; everything here exists to
// make typing pleasant. So this never refuses what billing would accept — an
// unreadable catalogue states NO floor rather than a guessed one, and the write
// goes out and is judged where it is judged.
//
// WHICH CEILINGS ARE JUDGED TOGETHER: every campaign on the CHANNEL, across the
// brand — billing's own grouping. A customer splitting one channel across two
// campaigns must not be refused for each half being under a floor the whole clears.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

/** One channel as `GET /public/channels` states it. Only what prices a ceiling. */
export interface PublishedChannelTerms {
  slug?: string | null;
  terms?: { dailyOperatingCostCents?: number | null } | null;
}

/** Every channel's floor in cents/day, keyed on its feature slug. */
export type ChannelMinimums = ReadonlyMap<string, number>;

/** The honest reading while the catalogue is settling or has failed: no floors. */
export const NO_CHANNEL_MINIMUMS: ChannelMinimums = new Map<string, number>();

/**
 * The floors a form is checked against, built from the published catalogue.
 *
 * A channel is priced only when its terms carry a finite, non-negative daily
 * operating cost. ZERO is a stated floor — a channel the customer operates
 * spends none of our money — while an ABSENT figure is not a floor of zero: it
 * is a channel whose price we were not told, and inventing one is the copy this
 * module exists to remove.
 */
export function channelMinimumsFromWire(
  channels: PublishedChannelTerms[] | null | undefined,
): ChannelMinimums {
  const minimums = new Map<string, number>();
  for (const channel of channels ?? []) {
    const slug = typeof channel?.slug === "string" ? channel.slug.trim() : "";
    if (!slug) continue;
    const cost = channel?.terms?.dailyOperatingCostCents;
    if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) continue;
    minimums.set(slug, cost);
  }
  return minimums;
}

/**
 * This channel's floor in cents, or null when the catalogue states none.
 *
 * Null is "we do not know", never zero. Every gate below reads it as "state no
 * floor and let billing decide", which is the one direction that cannot refuse
 * money billing would accept.
 */
export function channelMinimumCents(
  minimums: ChannelMinimums,
  featureSlug: string | null | undefined,
): number | null {
  if (!featureSlug) return null;
  return minimums.get(featureSlug) ?? null;
}

/** A floor as a person reads it. Whole dollars unless the figure is not one. */
export function fmtDailyFloorUsd(cents: number): string {
  const usd = cents / 100;
  return Number.isInteger(usd) ? `$${usd.toLocaleString("en-US")}` : `$${usd.toFixed(2)}`;
}

/**
 * True when billing already funds this channel UNDER the channel's own floor.
 *
 * The grandfather is derived from the stored ceiling and nothing else: no flag,
 * no column, no per-org override — the same rule billing derives it by.
 */
export function isGrandfatheredChannelFunding(
  minimumCents: number | null,
  savedGroupCents: number,
): boolean {
  if (minimumCents === null) return false;
  return savedGroupCents > 0 && savedGroupCents < minimumCents;
}

/**
 * Whether this channel may be funded at this many dollars a day,
 * given what it is funded at TODAY.
 *
 * Zero passes: a defunded channel is an ordinary state, not an error, and it is how
 * a customer stops one channel without losing anything else it stated.
 *
 * The floor governs what a customer may NEWLY state, never what one has already
 * been running. Ceilings predating it were carried over verbatim — they are the
 * money the brand actually spends — so live brands sit under their floor today.
 * Refusing every write of such a ceiling leaves its owner two moves: leave it
 * exactly alone, or defund it. Raising it TOWARDS the floor would be refused,
 * which is the wrong direction to block, and because the gate runs before a
 * whole form is saved it also blocked edits nobody was making to the money.
 *
 * So a channel funded under its floor may be kept, or raised to any higher figure
 * including one still under the floor. It may not be LOWERED to another funded
 * sub-floor figure: that is a new statement below the bar. The grandfather is
 * spent the moment the total reaches the floor, which falls out of the check
 * rather than needing a branch.
 *
 * A floor we could not read refuses nothing. billing still holds one and its
 * 400 still decides, so the floor is not lost — it is simply not restated here.
 */
export function channelBudgetBelowMinimum(
  minimumCents: number | null,
  dailyUsd: number,
  savedGroupCents: number,
): boolean {
  if (minimumCents === null) return false;
  if (dailyUsd <= 0) return false;
  const cents = Math.round(dailyUsd * 100);
  if (cents >= minimumCents) return false;
  if (!isGrandfatheredChannelFunding(minimumCents, savedGroupCents)) return true;
  return cents < savedGroupCents;
}

/**
 * The line under a channel's budget field. A channel already funded under its floor
 * is told what it may DO, not a starting figure it is already below: quoting the
 * floor there reads as "you are not allowed to be here", on a ceiling the brand
 * has been paying against for weeks.
 *
 * Null when the catalogue states no floor for this channel — the figure is the
 * channel's to publish, and there is nothing honest to write in its place.
 */
export function channelBudgetHint(
  minimumCents: number | null,
  savedGroupCents: number,
): string | null {
  if (minimumCents === null) return null;
  if (!isGrandfatheredChannelFunding(minimumCents, savedGroupCents)) {
    return `From ${fmtDailyFloorUsd(minimumCents)} a day.`;
  }
  return `Funded at ${fmtDailyFloorUsd(savedGroupCents)} a day today, which you can keep or raise.`;
}

/**
 * What to tell someone whose budget was refused. A grandfathered channel gets the
 * moves it actually has, not a floor it is not allowed to walk down to.
 *
 * `channelName` is what the customer calls the channel, because the floor is the
 * CHANNEL's.
 */
export function channelBudgetFloorMessage(
  channelName: string,
  minimumCents: number,
  savedGroupCents: number,
): string {
  const floor = fmtDailyFloorUsd(minimumCents);
  if (!isGrandfatheredChannelFunding(minimumCents, savedGroupCents)) {
    return `${channelName} needs at least ${floor} a day to run. Leave it empty to stop funding it.`;
  }
  const current = fmtDailyFloorUsd(savedGroupCents);
  return `${channelName} is funded at ${current} a day across every offer that sells through it. Keep it there or raise it, but it cannot go lower while it stays under ${floor}. Leave it empty to stop funding it.`;
}

/**
 * What the CHANNEL would be funded at once one ceiling's typed
 * figure lands, in whole dollars.
 *
 * The floor binds the channel, not one campaign's share: a customer splitting one
 * funded channel across two campaigns must not be refused for each half being under a
 * bar the whole clears. So the check and the clamp both ask what the CHANNEL total
 * becomes, holding the siblings this form is not editing constant.
 *
 * Computed ONLY to check a form before it is written. billing holds the channel
 * total and holds the same rule; nothing displayed is derived from this.
 */
export function projectedChannelTotalUsd(
  savedChannelCents: number,
  savedOwnCents: number,
  typedUsd: number,
): number {
  const siblings = Math.max(0, savedChannelCents - savedOwnCents);
  return Math.round(siblings / 100) + Math.max(0, typedUsd);
}

/**
 * The smallest FUNDED figure one ceiling of a channel may hold, in whole dollars —
 * what a typed value under the bar is put back to.
 *
 * Refusing a sub-floor figure and leaving it on screen makes the customer guess
 * what is allowed; naming the floor alone makes them do the subtraction the
 * siblings imply. So the field is restored to this and the surface says why.
 *
 * Derived from the SAME rule `channelBudgetBelowMinimum` enforces, in the same
 * two branches, so a clamped value can never itself be refused. The remainder is
 * rounded UP: rounding it down can land a dollar under the bar it was computed
 * from. The siblings are held constant, so a channel that already clears the bar
 * without this ceiling may hold any amount and the minimum is zero.
 *
 * ZERO is never clamped by the caller: defunding is an ordinary state, and the
 * bar governs what may be NEWLY stated, not whether a customer may stop. A floor
 * we could not read clamps to nothing, for the same reason it refuses nothing.
 */
export function minimumChannelBudgetUsd(
  minimumCents: number | null,
  savedGroupCents: number,
  savedOwnCents: number,
): number {
  if (minimumCents === null) return 0;
  const barCents = isGrandfatheredChannelFunding(minimumCents, savedGroupCents)
    ? savedGroupCents
    : minimumCents;
  const siblingsCents = Math.max(0, savedGroupCents - savedOwnCents);
  return Math.max(0, Math.ceil((barCents - siblingsCents) / 100));
}
