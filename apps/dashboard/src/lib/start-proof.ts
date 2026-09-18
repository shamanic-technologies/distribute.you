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
// The best workflow's price for a first step, cross-org.
//
// features-service prices every workflow dynasty on ONE objective per read. A
// workflow that produced NONE of the objective carries a price that is a floor,
// not a result, so only a row with at least one observed outcome may win. The
// pick is the cheapest of those: what our best model charges for a positive
// reply (or a website visit) is what a visitor is told a first step costs.

export interface WorkflowCostRow {
  workflowDynastySlug: string;
  observedClicks: number | null;
  observedPositiveReplies: number | null;
  costPerOutcomeUsd: number | null;
}

export type FirstStepObjective = "positiveReply" | "websiteVisit";

export function bestWorkflowCostUsd(
  rows: WorkflowCostRow[],
  objective: FirstStepObjective,
): number | null {
  const observed = (r: WorkflowCostRow) =>
    objective === "positiveReply" ? r.observedPositiveReplies ?? 0 : r.observedClicks ?? 0;
  let best: number | null = null;
  for (const r of rows) {
    const cost = r.costPerOutcomeUsd;
    if (observed(r) < 1 || typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) continue;
    if (best === null || cost < best) best = cost;
  }
  return best;
}

/**
 * Which first step a funnel is entered on, read off the producer's own rung
 * order: the FIRST rung after the entry. A funnel whose first rung is a positive
 * reply is priced per reply; one entered on a website visit per visit. Any other
 * entry (a funnel this flow does not sell today) states no price.
 */
export function firstStepObjective(
  stepKeys: readonly string[],
): FirstStepObjective | null {
  const first = stepKeys[0];
  if (first === "conversation") return "positiveReply";
  if (first === "website_visit") return "websiteVisit";
  return null;
}

export function firstStepLine(objective: FirstStepObjective, usd: number): string {
  const noun = objective === "positiveReply" ? "positive reply" : "website visit";
  return `$${Math.round(usd).toLocaleString("en-US")} per ${noun} on average`;
}

// ─────────────────────────────────────────────────────────────────────────
// The named clients: the homepage's three proof cards, off the same read.
//
// features-service publishes the funnel counts and the realized return of the
// clients who agreed to be named. The card leads with the PERSON behind the
// number, and the person is not on the wire (brand-service holds a domain and a
// name, not a founder's face), so the three are stated here, keyed on the domain
// the producer serves. A brand the producer serves that this map does not name
// draws no card: a client's figures never appear without their consent.

export interface ShowcaseStep {
  key: string;
  label: string;
  peopleReached: number | null;
  costPerReachUsd?: number | null;
}

export interface ShowcaseFunnel {
  funnelKey: string;
  funnelName: string;
  returnPerDollar?: number | null;
  steps: ShowcaseStep[];
}

export interface ShowcaseBrand {
  brand: { id: string; name: string; domain: string };
  funnels: ShowcaseFunnel[];
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

/** One proof card: a person, their return, the first step's price, the counts. */
export interface ProofCard {
  domain: string;
  person: ShowcasePerson;
  funnelKey: string;
  returnPerDollar: number;
  /** The first rung after contact: what it cost and what it is called. */
  firstStep: { label: string; costPerReachUsd: number | null } | null;
  /** Contacted first, then every rung somebody reached, in the producer's order. */
  counts: { label: string; peopleReached: number }[];
}

export const MAX_PROOF_CARDS = 3;

/**
 * The cards for a selection: every named client whose funnel is among the
 * picked ones, best return first, at most three.
 *
 * The join is on the FUNNEL KEY, the producer's own, so a card is only offered
 * for a path the visitor is actually looking at. A brand with no measured
 * return has nothing to lead with and draws no card; a rung nobody reached is
 * dropped from the counts rather than printed as a zero beside a real one.
 */
export function proofCardsFor(
  brands: ShowcaseBrand[],
  pickedFunnelKeys: readonly string[],
  people: Record<string, ShowcasePerson> = SHOWCASE_PEOPLE,
): ProofCard[] {
  const picked = new Set(pickedFunnelKeys);
  const cards: ProofCard[] = [];
  for (const b of brands) {
    const person = people[b.brand?.domain];
    if (!person || !b.measured) continue;
    for (const f of b.funnels ?? []) {
      if (!picked.has(f.funnelKey)) continue;
      const ret = f.returnPerDollar;
      if (typeof ret !== "number" || !Number.isFinite(ret) || ret <= 0) continue;
      const steps = f.steps ?? [];
      const first = steps[1] ?? null;
      cards.push({
        domain: b.brand.domain,
        person,
        funnelKey: f.funnelKey,
        returnPerDollar: ret,
        firstStep: first
          ? {
              label: first.label,
              costPerReachUsd:
                typeof first.costPerReachUsd === "number" ? first.costPerReachUsd : null,
            }
          : null,
        counts: steps
          .filter((s) => typeof s.peopleReached === "number" && s.peopleReached > 0)
          .map((s) => ({ label: s.label, peopleReached: s.peopleReached as number })),
      });
    }
  }
  cards.sort((a, b) => b.returnPerDollar - a.returnPerDollar);
  return cards.slice(0, MAX_PROOF_CARDS);
}

// ─────────────────────────────────────────────────────────────────────────
// Wording.

/** The commitment a path carries, as a tag: a fact about the channel's terms. */
export function commitmentTag(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "No commitment";
  return `${Math.round(days)}-day commitment`;
}

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
  screen: "outcome" | "funnels" | "returns",
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
  if (screen === "funnels" && proof.hotLeads) {
    return {
      figure: `$${Math.round(proof.hotLeads.medianCostUsd).toLocaleString("en-US")}`,
      label: "median cost per hot lead",
    };
  }
  if (screen === "returns" && proof.medianReturnPerDollar != null) {
    return { figure: formatReturn(proof.medianReturnPerDollar), label: "median ROI reported" };
  }
  return null;
}
