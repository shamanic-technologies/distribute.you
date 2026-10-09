/**
 * The step panel's "How we price it" lines (owner 2026-10-08): under each leg, every rate
 * features-service weighed for it, one line each, the kept one marked.
 *
 *   Measured in your CRM: 28 of 43 (65%)   Kept
 *   Measured in our data: 1 of 4 (25%)
 *   Your value: 32%
 *
 * The precedence and the kept flag are the producer's; this only words them. A fleet median
 * or the industry default is shown only when it is the rate in use: the owner's list is
 * the CRM, our data and the customer's own value.
 *
 * Alias-free on purpose (real unit tests, no `@/` at runtime).
 */

export type RateCandidateBasis = "crm" | "our_leads" | "manual" | "median" | "default";

export type RateCandidate = {
  basis: RateCandidateBasis;
  ratePct: number;
  fromReached: number | null;
  toReached: number | null;
  kept: boolean;
};

export type CandidateLine = { key: RateCandidateBasis; text: string; kept: boolean };

// A rate that rounds to 0.0% but is not zero reads "<0.1%", never a false 0.0%.
const pct = (v: number) => (v > 0 && v < 0.05 ? "<0.1%" : `${v < 10 ? v.toFixed(1) : Math.round(v)}%`);
const count = (n: number) => n.toLocaleString("en-US");

const MEASURED_WHERE: Partial<Record<RateCandidateBasis, string>> = {
  crm: "Measured in your CRM",
  our_leads: "Measured in our data",
};

function words(c: RateCandidate): string {
  const where = MEASURED_WHERE[c.basis];
  if (where) {
    return c.fromReached != null && c.toReached != null
      ? `${where}: ${count(c.toReached)} of ${count(c.fromReached)} (${pct(c.ratePct)})`
      : `${where}: ${pct(c.ratePct)}`;
  }
  if (c.basis === "manual") return `Your value: ${pct(c.ratePct)}`;
  if (c.basis === "median") return `Median of our clients: ${pct(c.ratePct)}`;
  return `Industry average: ${pct(c.ratePct)}`;
}

/** The lines to draw, in the producer's precedence order. */
export function candidateLines(candidates: readonly RateCandidate[]): CandidateLine[] {
  return candidates
    .filter((c) => c.kept || c.basis === "crm" || c.basis === "our_leads" || c.basis === "manual")
    .map((c) => ({ key: c.basis, text: words(c), kept: c.kept }));
}
