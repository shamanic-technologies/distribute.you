/**
 * THE HERO'S CLIENT CARDS ARE BUILT FROM THE WIRE, NOT RESEEDED INTO FROZEN MARKUP.
 *
 * The hero's live "who else grows on autopilot" row used to be three hand-written cards
 * whose FIGURES the server rewrote on every render: the numbers stayed true and the CHOICE
 * froze. features-service picks now (the most recently started clients that have produced
 * an outcome) and this module renders whatever it picked. Nothing here ranks, filters,
 * floors or divides: the order the producer states IS the order, and every figure is a
 * served field. The proof section below it keeps its shipped clients, figures reseeded
 * (`reseedProofCards`): its return-ranked pick is gone with the client return
 * (ROI-CONSISTENCY-1103). The hero's words are the page's own ({@link HERO_STEPS}).
 *
 * ── A ZERO IS DRAWN AND HIDDEN, NEVER DROPPED ───────────────────────────────────────
 *
 * `main.js` nudges the counters in-session and reveals a cell the first time its number
 * lands, so a rung nobody has reached yet has to be IN the DOM carrying `data-zero`.
 * Dropping it would leave the counter climbing in `data-steps` with nowhere to render and
 * the step would never come back however high it went.
 *
 * ── AND A FIGURE WE WERE NOT GIVEN IS NOT A ZERO ────────────────────────────────────
 *
 * The producer says `0` when it measured nobody and `null` when it could not measure. A
 * null rung is left OUT of the card entirely rather than drawn as an empty one: on a
 * marketing page a zero reads as a fact about the client, not as a gap in our reading.
 */
import type { ShowcaseBrand, ShowcaseOutcome } from "@/lib/showcase-outcomes";

/** The publishable logo.dev token the page already ships in its own markup. */
const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/**
 * Every character a brand's own name could carry that would end the attribute or the
 * element it sits in.
 *
 * Names come off the wire and are written by the customer, so they are escaped at every
 * interpolation. A brand called `Smith & Co "Ltd"` is a name, not markup.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

function logoUrl(domain: string, size: number): string {
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGO_TOKEN}&size=${size}&format=png`;
}

/**
 * A website visit is never drawn on a client card (owner 2026-10-19: « plus
 * jamais des "website visits" »). A visit proves attention, not demand; the cards prove
 * interested leads and booked meetings.
 */
const NEVER_DRAWN: ReadonlySet<string> = new Set(["website_visit"]);

/** The outcomes the producer actually measured, in its own order, minus the never-drawn ones. */
function measuredSteps(brand: ShowcaseBrand): ShowcaseOutcome[] {
  return (brand.outcomes ?? []).filter(
    (s) => typeof s.peopleReached === "number" && !NEVER_DRAWN.has(s.key)
  );
}

/**
 * THE HERO CARD STATES TWO FIGURES: interested leads, then meetings booked (owner 2026-10-19).
 *
 * Keyed on the producer's step keys; the hero's word for `conversation` is the owner's own,
 * "Interested leads".
 */
export const HERO_STEPS: readonly { key: string; label: string }[] = [
  { key: "conversation", label: "Interested leads" },
  { key: "meeting_booked", label: "Meetings booked" },
];

/**
 * A CLIENT ENTERS THE HERO ROW WITH AT LEAST ONE MEETING BOOKED OR ONE INTERESTED LEAD.
 *
 * Owner 2026-10-19: « les last 3 brand qui ont eu au moins des booked meetings, si moins de 3
 * ceux qui ont eu des Interested leads ». It lifts the 2026-10-10 floor of five: one booked
 * meeting is enough.
 * The producer picks and orders (meetings first); this only refuses a client whose card would
 * state two zeros.
 */
export function hasHeroOutcome(brand: ShowcaseBrand): boolean {
  return measuredSteps(brand).some(
    (step) => HERO_STEPS.some((h) => h.key === step.key) && (step.peopleReached as number) >= 1
  );
}

/**
 * One hero card: the client, its logo, and its outcomes walked step by step.
 *
 * Every attribute `main.js` reads is reproduced exactly — `data-live` to enter the nudge
 * rotation, `data-steps` as the counters it climbs, `data-n` as the cell index it paints,
 * `data-zero` on a rung nobody has reached, and `data-status` as the line it rewrites.
 * A card that loses one of them is a card that never moves.
 */
export function renderShowcaseCard(brand: ShowcaseBrand): string | null {
  const domain = brand.brand?.domain;
  const name = brand.brand?.name;
  if (!domain || !name) return null;
  const measured = measuredSteps(brand);
  const steps = HERO_STEPS.flatMap((hero) => {
    const step = measured.find((s) => s.key === hero.key);
    return step ? [{ key: hero.key, label: hero.label, value: step.peopleReached as number }] : [];
  });
  if (!steps.some((s) => s.value > 0)) return null;

  const counts = steps.map((s) => s.value);
  const cells = steps
    .map((step, index) => {
      const value = counts[index];
      const zero = value === 0 ? " data-zero" : "";
      return `<span class="sf" data-step="${esc(step.key)}"${zero}><b data-n="${index}">${formatInt(value)}</b><small>${esc(step.label)}</small></span>`;
    })
    .join("\n            ");

  return `<a class="show-card" href="#proof" data-live data-brand="${esc(domain)}" data-steps="${counts.join(",")}">
          <div class="show-top"><img src="${logoUrl(domain, 64)}" alt="" width="32" height="32"><div><div class="show-name">${esc(name)}</div><div class="show-domain">${esc(domain)}</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            ${cells}
          </div>
        </a>`;
}
