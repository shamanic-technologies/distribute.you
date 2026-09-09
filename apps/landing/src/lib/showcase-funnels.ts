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
 * `start_to_conversation` and we say "Sales interests"; that wording is the
 * customer's vocabulary and ours to choose, so only the FIGURE crosses the wire.
 */

/** One step of one funnel, as the producer states it. */
export interface ShowcaseStep {
  key: string;
  label: string;
  /** People who reached it. `null` means the producer could not measure it. */
  peopleReached: number | null;
}

export interface ShowcaseFunnel {
  funnelKey: string;
  funnelName: string;
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
 * Only the FIGURE is touched. The label beside it ("sales interests") is the
 * customer's vocabulary and ours to choose — the producer calls that rung
 * `start_to_conversation` — so the wire decides the number and the page decides
 * the words, exactly as it does for the showcase cards above.
 */
function reseedProofCard(card: string, counts: Map<string, number>): string {
  return card.replace(
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
 * ⚠️ The RETURN and the COST-PER-OUTCOME on these cards are still the figures the
 * page ships with. This read is counts-only by the producer's own design, and the
 * per-brand money read that would answer them does not exist yet — so those two
 * lines are deliberately left alone here rather than derived from anything. A ratio
 * computed in this file would be a metric invented by a consumer, which is the one
 * thing every figure on this page is not.
 */
export function reseedProofCards(html: string, data: ShowcaseFunnels): string {
  const byDomain = new Map<string, ShowcaseBrand>();
  for (const brand of data.brands ?? []) {
    if (brand?.brand?.domain) byDomain.set(brand.brand.domain, brand);
  }
  if (byDomain.size === 0) return html;

  return html.replace(
    /<article class="proof-card rv" data-proof-brand="([^"]+)">[\s\S]*?<\/article>/g,
    (card, domain: string) => {
      const brand = byDomain.get(domain);
      if (!brand) return card;
      const counts = countsByStep(brand);
      if (counts.size === 0) return card;
      return reseedProofCard(card, counts);
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
