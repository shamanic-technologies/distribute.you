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
// Engaged leads: the fleet's proof row, the SAME derivation the homepage hero uses.
//
// An "engaged lead" is a person who acted on our outreach: a positive reply OR a
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
  measured: boolean;
  unmeasuredReason: string | null;
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
}

/**
 * What the strip under the card says on each screen: one fleet COUNT. No fleet return is ever
 * stated (ROI-CONSISTENCY-1103: the median client ROI is retired from every screen).
 */
export function reassuranceFor(screen: "outcome", proof: FleetProof | null): { figure: string; label: string } | null {
  if (!proof) return null;
  if (screen === "outcome" && proof.hotLeads) {
    return {
      figure: proof.hotLeads.hotLeads.toLocaleString("en-US"),
      label: `engaged leads for ${proof.hotLeads.companies} companies`,
    };
  }
  return null;
}
