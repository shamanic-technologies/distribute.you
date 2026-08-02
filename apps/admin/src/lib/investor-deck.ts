/**
 * The investor deck: which slides, in what order, and how it is versioned.
 *
 * Alias-free on purpose (no `@/…` imports) so vitest can resolve it and these
 * helpers get REAL unit tests rather than source-substring guards.
 *
 * ## Where the shape comes from
 *
 * The spine is the weekly update the founder already writes — What, Why, the
 * growth rates, the Ask, Use of funds, Thanks, Need. Three slides are added to
 * it, each because omitting them is measurably expensive:
 *
 * - **Competition** drives the largest single jump in investor attention DocSend
 *   measured (+51%), and "we have no competitors" is the fastest-growing area of
 *   scrutiny.
 * - **Team** is the most-read slide in the deck at 22.8 seconds. Founders only —
 *   YC: "Nobody cares about your advisors."
 * - **Market** answers the question the numbers alone cannot: how big this gets.
 *
 * Sources: YC "How to Build Your Seed Round Pitch Deck" and "How to Design a
 * Better Pitch Deck" (Kevin Hale), Sequoia "Writing a Business Plan", DocSend's
 * 200-deck study and pre-seed guidance, Carta's 2025/2026 pre-seed reports.
 *
 * ## Two things this deck deliberately does NOT do
 *
 * 1. **It never prints the valuation cap.** DocSend, from 200 decks: "Don't list
 *    your deal terms in your deck. Deliver them in person. The terms can vary by
 *    investor." The ask names the amount and the instrument; the cap is a
 *    conversation, and printing it anchors every investor before there is any
 *    competitive tension.
 * 2. **It invents no number.** Every figure is read live from a served field.
 *    A deck is the highest-stakes place in the product to put a made-up figure,
 *    and a stale hardcoded metric here is worse than no metric.
 */

/** Slides in reading order. One idea each, per Kevin Hale's legible/simple/obvious rule. */
export type DeckSlideId =
  | "title"
  | "what"
  | "why"
  | "how"
  | "traction"
  | "economics"
  | "market"
  | "competition"
  | "team"
  | "ask"
  | "use-of-funds"
  | "thanks-and-needs";

export interface DeckSlideDef {
  id: DeckSlideId;
  /** Shown in the on-screen slide rail. Not printed. */
  navLabel: string;
}

/**
 * Twelve slides. DocSend's successful decks average 19.2 pages and 20 is the
 * hard ceiling; a minimal pre-seed raise has no business approaching it.
 */
export const DECK_SLIDES: DeckSlideDef[] = [
  { id: "title", navLabel: "Title" },
  { id: "what", navLabel: "What" },
  { id: "why", navLabel: "Why" },
  { id: "how", navLabel: "How it works" },
  { id: "traction", navLabel: "Traction" },
  { id: "economics", navLabel: "Unit economics" },
  { id: "market", navLabel: "Market" },
  { id: "competition", navLabel: "Competition" },
  { id: "team", navLabel: "Team" },
  { id: "ask", navLabel: "The ask" },
  { id: "use-of-funds", navLabel: "Use of funds" },
  { id: "thanks-and-needs", navLabel: "Thanks and needs" },
];

/** The raise. Stated as fact because these two are decided; the cap is not here on purpose. */
export const RAISE_AMOUNT_USD = 100_000;
export const RAISE_INSTRUMENT = "equity or a post-money SAFE";

// ── Versioning ───────────────────────────────────────────────────────────────

/**
 * The deck is identified by the WEEK it reports on, which is the same number the
 * founder's written update carries ("Week #19") and the same `barsUsed` the
 * CWGR headline already states. That makes it durable with no storage and no
 * inception date to hardcode: the week number is the count of concluded weekly
 * buckets behind the growth rate, so it advances on its own and cannot drift
 * from the figures on the slide.
 *
 * A click counter was considered and rejected. Two downloads of the same week's
 * numbers are the same deck, and numbering them v3 and v4 would be false.
 */
export interface DeckVersion {
  /** "Week #19", or null when there is not yet a concluded week to report. */
  label: string | null;
  weekNumber: number | null;
  /** The day the deck was produced, ISO. */
  date: string;
}

export function deckVersion(weeksUsed: number | null, now: Date): DeckVersion {
  const date = now.toISOString().slice(0, 10);
  if (weeksUsed === null || weeksUsed < 1) {
    // No concluded week means no rate and no week to report. Say so rather than
    // stamping "Week #0", which would read as a real edition.
    return { label: null, weekNumber: null, date };
  }
  return { label: `Week #${weeksUsed}`, weekNumber: weeksUsed, date };
}

/**
 * Filename for the download. Carries the week and the date so a recipient can
 * tell two editions apart in a mail client without opening them.
 */
export function deckFileName(version: DeckVersion): string {
  const stem = version.weekNumber === null
    ? `distribute-investor-deck-${version.date}`
    : `distribute-investor-deck-week-${version.weekNumber}-${version.date}`;
  return `${stem}.pdf`;
}

/** Long form for the title slide, e.g. "Week #19 · 2 August 2026". */
export function deckVersionLine(version: DeckVersion): string {
  const day = new Date(`${version.date}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return version.label === null ? day : `${version.label} · ${day}`;
}

// ── Figures ──────────────────────────────────────────────────────────────────

/**
 * One growth headline. `pct` and `weeksUsed` are read from the same served
 * summary the metrics page uses, never recomputed — and `weeksUsed` travels with
 * the rate because a compound rate means nothing without the span it compounds
 * over.
 */
export interface DeckGrowthFigure {
  label: string;
  /** Compounded weekly growth rate. Null when there is not enough history to grade. */
  pct: number | null;
  /** The current absolute value the rate has grown to, already formatted. */
  current: string | null;
  weeksUsed: number | null;
}

/**
 * A growth rate of exactly zero is a real, reportable number — the founder's own
 * update states "+0%/week signups" — so it must render as `+0%` and never be
 * collapsed into the "we could not measure this" branch. Only null means
 * unmeasured.
 */
export function formatGrowthRate(pct: number | null): string {
  if (pct === null) return "Not measured yet";
  // `+ 0` normalises -0, which would otherwise print as "-0".
  const rounded = Math.round(pct * 10) / 10 + 0;
  // Zero takes the plus sign: "+0%/week" is how a flat week is reported, and a
  // bare "0%/week" reads like a missing value rather than a measured one.
  const sign = rounded >= 0 ? "+" : "";
  return `${sign}${rounded}%/week`;
}

/**
 * The span a compound rate covers, as words. Null when there is no rate, because
 * there is then no span to state.
 */
export function growthSpanLabel(weeksUsed: number | null): string | null {
  if (weeksUsed === null || weeksUsed < 1) return null;
  return weeksUsed === 1 ? "over 1 week" : `over ${weeksUsed} weeks`;
}

/**
 * Every deck chart states its conclusion in words rather than making the reader
 * derive it — Kevin Hale's rule, and the difference between a chart that informs
 * and one that decorates.
 */
export function growthConclusion(figure: DeckGrowthFigure): string | null {
  if (figure.pct === null) return null;
  const span = growthSpanLabel(figure.weeksUsed);
  const rate = formatGrowthRate(figure.pct);
  if (figure.pct > 0) {
    return span ? `${figure.label} compounding at ${rate} ${span}.` : `${figure.label} compounding at ${rate}.`;
  }
  if (figure.pct === 0) {
    return `${figure.label} flat${span ? ` ${span}` : ""}. This is the gap we are raising to close.`;
  }
  return span ? `${figure.label} declining at ${rate} ${span}.` : `${figure.label} declining at ${rate}.`;
}
