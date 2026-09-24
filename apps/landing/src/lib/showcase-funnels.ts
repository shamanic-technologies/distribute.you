import { formatCostUsd, formatReturnMultiple } from "@/lib/landing-format";
import { hasDrawnOutcome, podium, renderProofCard, renderShowcaseCard } from "@/lib/showcase-cards";

/**
 * The homepage's three named clients state funnel counts we READ, not counts we
 * pasted in.
 *
 * They used to be literals, captured out of production by hand on 2026-09-06 and
 * frozen in the page. That was defensible while the page lived behind a password;
 * it stopped being defensible the day the page was promoted to the apex, where the
 * figures are public, indexable and ageing in front of every visitor. Nothing
 * refreshed them and nothing could go red about it — the page renders perfectly
 * whatever the numbers say.
 *
 * The reseed happens at RENDER, server-side, exactly like the fleet's hot-lead
 * figures beside it: one read per rendered page rather than one per visitor, no API
 * origin in the browser, and no CORS question (features-service's allowlist still
 * names a retired brand's domains, so the page could not call it directly even if we
 * wanted it to). The in-session nudge in `v2/main.js` then climbs from a real base
 * instead of a stale one.
 *
 * ⚠️ Cells are joined to steps by the producer's own KEY, never by position. The two
 * orders genuinely differ: a card draws four cells for a five-step funnel — Doc
 * Dinners shows Closed won and skips Meeting attended — so an index join would put
 * the count of people who attended a meeting under the label for deals won. It would
 * render, it would look plausible, and it would be a different number entirely.
 *
 * ⚠️ And the LABELS stay in the HTML. The producer calls the reply step
 * `start_to_conversation` and we say "Positive replies"; that wording is the
 * customer's vocabulary and ours to choose, so only the FIGURE crosses the wire.
 */

/** One step of one funnel, as the producer states it. */
export interface ShowcaseStep {
  key: string;
  label: string;
  /** People who reached it. `null` means the producer could not measure it. */
  peopleReached: number | null;
  /**
   * What reaching this rung cost the client, in dollars. `null` is "we have no
   * figure" and sits beside a MEASURED `0` count on a rung nobody reached — the two
   * say different things, which is what lets a card blank one and print the other.
   * A `$0` there would read as this client's customers having been free.
   */
  costPerReachUsd?: number | null;
}

export interface ShowcaseFunnel {
  funnelKey: string;
  funnelName: string;
  /**
   * What the client got back on the budget they paid, on this funnel.
   *
   * The REALIZED return their own dashboard states — expected pipeline over
   * committed spend — never the forward projection published elsewhere under the
   * identical word. Production has had the two an order apart; relabelling one as
   * the other would put a number on the homepage no client ever saw.
   */
  returnPerDollar?: number | null;
  steps: ShowcaseStep[];
}

export interface ShowcaseBrand {
  brand: { id: string; name: string; domain: string };
  funnels: ShowcaseFunnel[];
  measured: boolean;
  unmeasuredReason: string | null;
}

export interface ShowcaseFunnels {
  brands: ShowcaseBrand[];
  /**
   * THE PRODUCER'S TWO PICKS.
   *
   * Absent means features-service is still on its earlier contract — figures, no pick — and the page
   * then keeps the three clients it ships with and reseeds only their figures, exactly as it did
   * before the pick existed. That fallback is the SHIPPED page, not a fabricated one.
   */
  groups?: {
    /** Most recently begun clients carrying at least one outcome, newest first. */
    recentlyStarted?: ShowcaseGroup;
    /** Best measured return on what they paid, past `minSpendUsd`, best first. */
    highestReturn?: ShowcaseGroup;
  };
  /**
   * The spend floor the return ranking was taken over, in dollars.
   *
   * Read for the record rather than applied: the floor is the PRODUCER's and is load-bearing —
   * measured in prod, an unfloored ranking tops out at 21.5x on $4.12 of spend. Applying one here
   * would be this page ranking clients, which it does not do.
   */
  minSpendUsd?: number;
}

/**
 * ONE OF THE PRODUCER'S PICKS, WITH ITS OWN VERDICT ON WHETHER IT COULD ANSWER.
 *
 * `measured: false` always carries a reason, and a SHORT group is a stated fact
 * (`qualifyingCount < requestedCount`) rather than a list a reader has to count — so an empty or
 * short answer is never served silently, and is never mistaken here for a pick.
 */
export interface ShowcaseGroup {
  brands: ShowcaseBrand[];
  measured: boolean;
  unmeasuredReason: string | null;
  requestedCount?: number;
  qualifyingCount?: number;
}

/** Every step the producer states for a domain, flattened and keyed. */
function countsByStep(brand: ShowcaseBrand): Map<string, number> {
  const out = new Map<string, number>();
  for (const funnel of brand.funnels ?? []) {
    for (const step of funnel.steps ?? []) {
      // A step the producer could not measure is LEFT ALONE below, never written as
      // a zero — "we have no figure" and "nobody reached it" are different answers,
      // and the card hides a real zero rather than stating it.
      if (typeof step.peopleReached === "number") out.set(step.key, step.peopleReached);
    }
  }
  return out;
}

/**
 * The funnel a card states it is about.
 *
 * A brand may sell through several, and a card names ONE outcome, so the funnel is
 * read off the card's own key rather than taken as the brand's first — that default
 * is right today by accident (every showcase brand sells one) and silently wrong the
 * day one of them adds a second.
 */
function funnelNamedBy(card: string, brand: ShowcaseBrand): ShowcaseFunnel | null {
  const named = /data-proof-funnel="([a-z_]+)"/.exec(card)?.[1];
  if (!named) return null;
  return (brand.funnels ?? []).find((funnel) => funnel.funnelKey === named) ?? null;
}

/** Every rung the producer priced on that funnel, keyed. */
function costsByStep(funnel: ShowcaseFunnel | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const step of funnel?.steps ?? []) {
    // Same rule as the counts: a rung we have no figure for is LEFT ALONE, never
    // written as a zero.
    if (typeof step.costPerReachUsd === "number") out.set(step.key, step.costPerReachUsd);
  }
  return out;
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Rewrite one card's cells from the counts the producer states for its brand.
 *
 * Everything the read does not answer for is left exactly as the page ships it, so a
 * partial payload degrades to the previous figure rather than to a blank or a zero.
 */
function reseedCard(card: string, counts: Map<string, number>): string {
  const values: number[] = [];

  const rewritten = card.replace(
    /<span class="sf" data-step="([a-z_]+)"( data-zero)?><b data-n="(\d+)">([^<]*)<\/b>/g,
    (whole, key: string, zeroAttr: string | undefined, n: string, current: string) => {
      const served = counts.get(key);
      if (served === undefined) {
        // Keep the shipped literal AND its shipped zero-state; record it so the
        // card's `data-steps` stays in step with what is on screen.
        const parsed = Number(current.replace(/,/g, ""));
        values.push(Number.isFinite(parsed) ? parsed : 0);
        return whole;
      }
      values.push(served);
      // A step at zero is HIDDEN rather than removed — `main.js` reveals the cell
      // when the counter first lands on it, so the cell has to stay in the DOM.
      const zero = served === 0 ? " data-zero" : "";
      return `<span class="sf" data-step="${key}"${zero}><b data-n="${n}">${formatInt(served)}</b>`;
    }
  );

  return rewritten.replace(/data-steps="[^"]*"/, `data-steps="${values.join(",")}"`);
}

/**
 * Reseed every showcase card in the page from a served payload.
 *
 * A brand the producer does not answer for keeps the figures the page ships with:
 * they are the last read we know landed, which is strictly better than blanking a
 * card or standing a zero in for a number we simply were not told.
 */
/**
 * Rewrite one proof card's funnel cells from the counts the producer states.
 *
 * Only the FIGURE is touched. The label beside it ("positive replies") is the
 * customer's vocabulary and ours to choose — the producer calls that rung
 * `start_to_conversation` — so the wire decides the number and the page decides
 * the words, exactly as it does for the showcase cards above.
 */
function reseedProofCard(
  card: string,
  counts: Map<string, number>,
  costs: Map<string, number>,
  returnPerDollar: number | null
): string {
  let out = card.replace(
    /<span data-proof-step="([a-z_]+)"><b>([^<]*)<\/b>/g,
    (whole, key: string, current: string) => {
      const served = counts.get(key);
      // A step the read does not answer for keeps the figure the page ships with:
      // it is the last count we know landed, which beats blanking a client's card
      // or standing a zero in for a number nobody told us.
      if (served === undefined) return whole;
      void current;
      return `<span data-proof-step="${key}"><b>${formatInt(served)}</b>`;
    }
  );

  // The card names ONE rung in its own words ("Cost per positive reply") and carries
  // that rung's key beside it, so the price is joined by key like every count above.
  // The producer prices every rung on one formula, base included, which is what lets
  // one card ask for a booked meeting and its neighbour for a website visit with no
  // branch here for either.
  out = out.replace(
    /(<div class="proof-line" data-proof-cost-step="([a-z_]+)"><span>[^<]*<\/span><b>)([^<]*)(<\/b>)/,
    (whole, open: string, key: string, current: string, close: string) => {
      const served = costs.get(key);
      if (served === undefined) return whole;
      void current;
      return `${open}${formatCostUsd(served)}${close}`;
    }
  );

  if (returnPerDollar === null) return out;
  const shaped = formatReturnMultiple(returnPerDollar);
  // `data-decimals` moves with the figure: main.js reads it to format every frame of
  // the count-up, so a return that crosses 10x and keeps a stale `1` would animate
  // to a decimal it no longer states.
  return out.replace(
    /(<span class="big") data-count="[^"]*" data-decimals="[^"]*"/,
    `$1 data-count="${shaped.text}" data-decimals="${shaped.decimals}"`
  );
}

/**
 * Reseed the three named clients' proof cards from the SAME payload the showcase
 * cards above are reseeded from.
 *
 * The two surfaces state the same clients' counts about 600px apart, so they must
 * ride one read: while the showcase cards were live (#3976) and these were frozen
 * literals, the page stated two different contacted counts for one client on one
 * screen — Doc Dinners read 12,552 at the top and 12,307 further down.
 *
 * The RETURN and the COST-PER-OUTCOME are read too, since features-service widened
 * this same pass to carry them (v0.160.0) — nothing here divides anything. A ratio
 * computed in this file would be a metric invented by a consumer, which is the one
 * thing every figure on this page is not; a `null` from the producer means "not
 * measured" and leaves the shipped figure alone.
 */
export function reseedProofCards(html: string, data: ShowcaseFunnels): string {
  const byDomain = new Map<string, ShowcaseBrand>();
  for (const brand of data.brands ?? []) {
    if (brand?.brand?.domain) byDomain.set(brand.brand.domain, brand);
  }
  if (byDomain.size === 0) return html;

  return html.replace(
    /<article class="proof-card rv" data-proof-brand="([^"]+)"[^>]*>[\s\S]*?<\/article>/g,
    (card, domain: string) => {
      const brand = byDomain.get(domain);
      if (!brand) return card;
      const counts = countsByStep(brand);
      const funnel = funnelNamedBy(card, brand);
      const costs = costsByStep(funnel);
      const roi =
        funnel && typeof funnel.returnPerDollar === "number" ? funnel.returnPerDollar : null;
      if (counts.size === 0 && costs.size === 0 && roi === null) return card;
      return reseedProofCard(card, counts, costs, roi);
    }
  );
}

export function reseedShowcaseCards(html: string, data: ShowcaseFunnels): string {
  const byDomain = new Map<string, ShowcaseBrand>();
  for (const brand of data.brands ?? []) {
    if (brand?.brand?.domain) byDomain.set(brand.brand.domain, brand);
  }
  if (byDomain.size === 0) return html;

  return html.replace(
    /<a class="show-card" href="#proof" data-live data-brand="([^"]+)"[\s\S]*?<\/a>/g,
    (card, domain: string) => {
      const brand = byDomain.get(domain);
      if (!brand) return card;
      const counts = countsByStep(brand);
      if (counts.size === 0) return card;
      return reseedCard(card, counts);
    }
  );
}


/**
 * THE CLIENTS OF ONE PICK, OR NOTHING.
 *
 * A group answers its OWN question and carries its OWN verdict, so the two are read independently:
 * "who started most recently and has produced something" and "who returns best on what they paid"
 * were never meant to name the same clients, and the producer says outright that a client may be in
 * both groups or in neither.
 *
 * So one group going unanswered does NOT hold the other back. An earlier cut of this required both
 * or neither, on a worry about coherence — a dynamically-picked client in the hero beside a frozen
 * one in the proof section. That worry was wrong about the surfaces and would have been expensive:
 * the recent group answers `no_qualifying_clients` in production today, so "both or nothing" would
 * have shipped the return podium as dead code.
 *
 * `measured: false` is the producer declining to answer and is honoured — the page keeps its shipped
 * clients for that section rather than rendering a short or empty row. A SHORT group is a different
 * thing and IS rendered: the producer states how many qualified, so fewer than three is an answer.
 */
export function pickedBrands(group: ShowcaseGroup | undefined, label: string): ShowcaseBrand[] | null {
  if (!group) return null;
  if (!group.measured) {
    // Loud, never swallowed: the producer could not answer, and the page silently keeping its
    // shipped clients is exactly the kind of thing nobody notices for a month.
    console.warn(
      `[landing] showcase group "${label}" unmeasured (${group.unmeasuredReason ?? "no reason given"}), keeping the shipped clients`
    );
    return null;
  }
  const served = Array.isArray(group.brands) ? group.brands : [];
  const brands = served.filter(hasDrawnOutcome);
  if (brands.length < served.length) {
    console.warn(
      `[landing] showcase group "${label}" dropped ${served.length - brands.length} client(s) whose drawn funnel shows nothing past outreach`
    );
  }
  // Nobody left to name: the section keeps its shipped clients, reseeded, like an unanswered group.
  if (brands.length === 0) return null;
  if (
    typeof group.qualifyingCount === "number" &&
    typeof group.requestedCount === "number" &&
    group.qualifyingCount < group.requestedCount
  ) {
    console.warn(
      `[landing] showcase group "${label}" is short: ${group.qualifyingCount} of ${group.requestedCount} clients qualified`
    );
  }
  return brands;
}

/**
 * Replace the hero's client cards with the producer's pick, leaving the "Your company"
 * card exactly where it ships.
 *
 * That last card is the page's own call to action rather than a client, so it is not part
 * of the pick and must stay last — it is what the whole row is arguing towards.
 */
export function renderShowcaseSelection(html: string, brands: ShowcaseBrand[]): string {
  const cards = brands
    .filter(hasDrawnOutcome)
    .map(renderShowcaseCard).filter((card): card is string => card !== null);
  // Every client the producer picked failed to render — a payload with no measured rung
  // for any of them. Keeping the shipped row beats emptying the hero.
  if (cards.length === 0) return html;
  return html.replace(
    /(<div class="showcase-grid" id="live-cards">\s*)[\s\S]*?(\s*<a class="show-card yours")/,
    (whole, open: string, tail: string) => `${open}${cards.join("\n        ")}${tail}`
  );
}

/**
 * Replace the proof section's cards with the producer's pick, laid out best-left,
 * third-middle, second-right.
 *
 * The ORDER on the wire is the ranking and is untouched; {@link podium} only decides where
 * each of the three sits on the row.
 */
export function renderProofSelection(html: string, brands: ShowcaseBrand[]): string {
  const cards = podium(brands.filter(hasDrawnOutcome))
    .map(renderProofCard)
    .filter((card): card is string => card !== null);
  // A proof card leads with a return, so a pick carrying none renders nothing — and the
  // shipped three, whose returns are reseeded, are a better answer than an empty section.
  if (cards.length === 0) return html;
  // Bounded to the proof grid's OWN cards: an unbounded `[\s\S]*</article>` runs to the LAST
  // article on the page and deletes every section in between (quotes, pricing, FAQ).
  return html.replace(
    /(<div class="proof-grid">\s*)(?:<article class="proof-card rv"[\s\S]*?<\/article>\s*)+/,
    (_whole, open: string) => `${open}${cards.join("\n      ")}\n`
  );
}
