// THE PROOF the signed-out onboarding states beside its questions: what the fleet
// has produced, what the best workflow charges for a first step, and which named
// clients got what back on the paths the visitor picked.
//
// Every figure here is READ off a producer at the scope it computed it. What this
// module decides is SELECTION (which row, which three brands, which step) and
// WORDING; it divides nothing, and a figure the producer cannot state is null,
// never a number of our own.
//
// Only value imports that carry no "@" alias live here, so the module stays
// directly unit-testable (vitest does not resolve the alias).

// ─────────────────────────────────────────────────────────────────────────
// Hot leads: the fleet's proof row, the SAME derivation the homepage hero uses.
//
// A "hot lead" is a person who showed buying interest: a positive reply OR a
// visit to the brand's site. All three figures describe ONE set of brands, those
// with at least one hot lead AND recorded spend, so the count, the company count
// and the price can never describe different populations. A median over a single
// brand is that brand's own price, not a fleet figure.

export interface RankedBrandItem {
  stats: Record<string, number | null>;
}

export interface HotLeadStats {
  hotLeads: number;
  companies: number;
  medianCostUsd: number;
}

const MIN_HOT_LEAD_BRANDS = 2;

function num(stats: Record<string, number | null>, key: string): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function hotLeadStats(results: RankedBrandItem[]): HotLeadStats | null {
  const priced = results
    .map((item) => ({
      hot: num(item.stats, "recipientsRepliesPositive") + num(item.stats, "recipientsClicked"),
      costCents: num(item.stats, "totalCostInUsdCents"),
    }))
    .filter((brand) => brand.hot > 0 && brand.costCents > 0);

  if (priced.length < MIN_HOT_LEAD_BRANDS) return null;

  const hotLeads = priced.reduce((total, brand) => total + brand.hot, 0);
  if (hotLeads <= 0) return null;

  const perBrandUsd = priced.map((brand) => brand.costCents / 100 / brand.hot).sort((a, b) => a - b);
  const mid = Math.floor(perBrandUsd.length / 2);
  const medianCostUsd =
    perBrandUsd.length % 2 === 0 ? (perBrandUsd[mid - 1] + perBrandUsd[mid]) / 2 : perBrandUsd[mid];

  return { hotLeads, companies: priced.length, medianCostUsd };
}

// ─────────────────────────────────────────────────────────────────────────
// The named clients: the homepage's three proof cards, off the same read.
//
// features-service publishes the outcome counts and the realized return of the clients
// who agreed to be named (`/public/stats/showcase-outcomes`: one entry per step their
// legs reach, merged across every leg they ran). The card leads with
// the PERSON behind the number, and the person is not on the wire (brand-service holds a domain and a
// name, not a founder's face), so the three are stated here, keyed on the domain
// the producer serves. A brand the producer serves that this map does not name
// draws no card: a client's figures never appear without their consent.

/** One outcome a named client reached: a step, or `contacted` for the outreach base. */
export interface ShowcaseOutcome {
  key: string;
  label: string;
  peopleReached: number | null;
  costPerReachUsd?: number | null;
}

export interface ShowcaseBrand {
  brand: { id: string; name: string; domain: string };
  /** In the producer's order: `contacted` first, then every step the brand's legs reach. */
  outcomes: ShowcaseOutcome[];
  /** The brand's own REALIZED return across everything it ran. */
  returnPerDollar?: number | null;
  measured: boolean;
  unmeasuredReason: string | null;
}

export interface ShowcasePerson {
  name: string;
  role: string;
  /** Path under the dashboard's `public/`. */
  portrait: string;
}

export const SHOWCASE_PEOPLE: Record<string, ShowcasePerson> = {
  "docdinners.com": {
    name: "Ryan W.D. Parenti",
    role: "Founder, Doc Dinners",
    portrait: "/start/ryan-parenti.jpg",
  },
  "opsfolio.com": {
    name: "Shahid Shah",
    role: "CEO Netspective, Opsfolio",
    portrait: "/start/shahid-shah.jpg",
  },
  "shockwavecenters.com": {
    name: "David Tucker",
    role: "Cofounder, Shockwave Centers",
    portrait: "/start/david-tucker.jpg",
  },
};

/** One proof card: a person, their return, the outcome it reached, the counts. */
export interface ProofCard {
  /** Stable per card: one card per named client, so the domain. */
  id: string;
  domain: string;
  person: ShowcasePerson;
  /** The deepest step somebody reached, in the producer's words. */
  outcomeLabel: string | null;
  returnPerDollar: number;
  /** The first rung after contact: what it cost and what it is called. */
  firstStep: { label: string; costPerReachUsd: number | null } | null;
  /** Contacted first, then every rung somebody reached, in the producer's order. */
  counts: { label: string; peopleReached: number }[];
}

export const MAX_PROOF_CARDS = 3;

/**
 * The TOP THREE named clients by return, whatever they bought.
 *
 * Owner-decided (2026-09-18): the cards are the best returns we can name, not
 * the clients who happened to run what the visitor picked; each card names the
 * outcome it reached instead.
 *
 * There is NO floor (owner-decided 2026-09-19: "toujours 3, le top 3 global en
 * terme de ROI"). A floor at the fleet median shipped for one day and left ONE
 * card on the screen, because two of the three consenting clients sit under the
 * median that the strip beside them states. The owner would rather read three
 * real returns beside that median than one; the cards are drawn in a random
 * order by the caller so the list does not read as a ranking.
 *
 * A brand with no measured return has nothing to lead with and draws no card;
 * a rung nobody reached is dropped from the counts rather than printed as a
 * zero beside a real one.
 */
export function proofCardsFor(
  brands: ShowcaseBrand[],
  people: Record<string, ShowcasePerson> = SHOWCASE_PEOPLE,
): ProofCard[] {
  const cards: ProofCard[] = [];
  for (const b of brands) {
    const person = people[b.brand?.domain];
    if (!person || !b.measured) continue;
    const ret = b.returnPerDollar;
    if (typeof ret !== "number" || !Number.isFinite(ret) || ret <= 0) continue;
    const outcomes = b.outcomes ?? [];
    const first = outcomes[1] ?? null;
    const reached = outcomes.filter((s) => typeof s.peopleReached === "number" && s.peopleReached > 0);
    cards.push({
      id: b.brand.domain,
      domain: b.brand.domain,
      person,
      outcomeLabel: reached.length > 1 ? reached[reached.length - 1].label : null,
      returnPerDollar: ret,
      firstStep: first
        ? {
            label: first.label,
            costPerReachUsd: typeof first.costPerReachUsd === "number" ? first.costPerReachUsd : null,
          }
        : null,
      counts: reached.map((s) => ({ label: s.label, peopleReached: s.peopleReached as number })),
    });
  }
  cards.sort((a, b) => b.returnPerDollar - a.returnPerDollar);
  return cards.slice(0, MAX_PROOF_CARDS);
}

/**
 * A Fisher-Yates shuffle driven by ONE seed in [0, 1), so the caller can pick
 * the seed once per mount and the order holds across polls and re-renders:
 * cards that reorder on every tick read as broken. Never mutates its input.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  // mulberry32 off the seed's 32-bit expansion: small, deterministic, no dep.
  let state = Math.floor(seed * 0x100000000) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Wording.

export interface FleetProof {
  hotLeads: HotLeadStats | null;
  /** The fleet's median return on spend, over brands past the producer's floor. */
  medianReturnPerDollar: number | null;
}

/**
 * What the strip under the card says on each screen. The welcome keeps the
 * founders; each question after it gets one fleet figure, the way the homepage
 * hero states its three. A figure we do not hold falls back to the founders
 * line, never to a blank.
 */
export function reassuranceFor(
  screen: "outcome" | "returns",
  proof: FleetProof | null,
  formatReturn: (x: number) => string,
): { figure: string; label: string } | null {
  if (!proof) return null;
  if (screen === "outcome" && proof.hotLeads) {
    return {
      figure: proof.hotLeads.hotLeads.toLocaleString("en-US"),
      label: `hot leads for ${proof.hotLeads.companies} companies`,
    };
  }
  if (screen === "returns" && proof.medianReturnPerDollar != null) {
    return { figure: formatReturn(proof.medianReturnPerDollar), label: "median ROI reported" };
  }
  return null;
}
