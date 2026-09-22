/**
 * THE HOMEPAGE'S CLIENT CARDS ARE BUILT FROM THE WIRE, NOT RESEEDED INTO FROZEN MARKUP.
 *
 * Two surfaces name real clients: the hero's live "who else grows on autopilot" row, and
 * the "what our clients got back" proof section about 600px below it. Until now both were
 * three hand-written cards naming three hand-picked domains, and the server rewrote the
 * FIGURES inside them on every render. That kept the numbers true and left the CHOICE
 * frozen: the same three clients, in the same order, whatever the fleet had done since.
 *
 * features-service picks now — the most recently started clients that have produced an
 * outcome for the hero, the highest-returning clients for the proof section — and this
 * module renders whatever it picked. Nothing here ranks, filters, floors or divides: the
 * order the producer states IS the order, and every figure is a served field.
 *
 * ── THE PAGE STILL OWNS THE WORDS ───────────────────────────────────────────────────
 *
 * The producer calls a rung `start_to_conversation` and labels it "Positive reply"; the
 * page says "Sales interests". That wording is the customer's vocabulary and ours to
 * choose, so {@link STEP_LABEL} is the page's own and the producer's label is only the
 * fallback for a rung this file has never heard of. Same rule as when the cards were
 * frozen markup — only the FIGURE ever crossed the wire.
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
import { formatCostUsd, formatReturnMultiple } from "@/lib/landing-format";
import { personFor } from "@/lib/showcase-people";
import type { ShowcaseBrand, ShowcaseFunnel, ShowcaseStep } from "@/lib/showcase-funnels";

/** The publishable logo.dev token the page already ships in its own markup. */
const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/** The outreach base — a rung of no funnel, and the one every funnel converts from. */
const CONTACTED = "contacted";

/**
 * THE PAGE'S OWN WORD FOR EACH RUNG, plural for a count and singular for a price.
 *
 * Keyed on the producer's stable leg key, never on its label: the label is buyer-facing
 * wording on ITS side and may be reworded, and a join on words is a join that silently
 * stops matching. A rung absent from here falls back to the producer's own label, so a
 * funnel this page has never drawn still renders rather than going blank.
 */
const STEP_LABEL: Readonly<Record<string, { plural: string; singular: string }>> = {
  contacted: { plural: "Contacted", singular: "contact" },
  start_to_conversation: { plural: "Sales interests", singular: "sales interest" },
  start_to_website_visit: { plural: "Website visits", singular: "website visit" },
  conversation_to_meeting_booked: { plural: "Meetings booked", singular: "meeting booked" },
  meeting_booked_to_meeting_attended: { plural: "Meetings attended", singular: "meeting attended" },
  meeting_attended_to_paid_client: { plural: "Closed won", singular: "closed deal" },
  website_visit_to_form_submitted: { plural: "Form submissions", singular: "form submission" },
  form_submitted_to_paid_client: { plural: "Closed won", singular: "closed deal" },
  website_visit_to_signup: { plural: "Signups", singular: "signup" },
  signup_to_paid_client: { plural: "Closed won", singular: "closed deal" },
};

function pluralLabel(step: ShowcaseStep): string {
  return STEP_LABEL[step.key]?.plural ?? step.label;
}

function singularLabel(step: ShowcaseStep): string {
  return STEP_LABEL[step.key]?.singular ?? step.label.toLowerCase();
}

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
 * The one funnel a card is about.
 *
 * A client may sell through several and a card names ONE outcome, so drawing the first
 * would state a funnel nobody asked about the day a client adds a second. The pick is the
 * funnel carrying a stated return — that is the figure the proof card leads with — and
 * the first otherwise, which is what every client has today.
 */
export function cardFunnel(brand: ShowcaseBrand): ShowcaseFunnel | null {
  const funnels = brand.funnels ?? [];
  if (funnels.length === 0) return null;
  return funnels.find((f) => typeof f.returnPerDollar === "number") ?? funnels[0];
}

/** The rungs the producer actually measured, in the funnel's own order. */
function measuredSteps(funnel: ShowcaseFunnel | null): ShowcaseStep[] {
  return (funnel?.steps ?? []).filter((s) => typeof s.peopleReached === "number");
}

/**
 * The rung a card prices.
 *
 * The FIRST conversion after the outreach base — the outcome the channel is bought for,
 * and the one all three hand-written cards named. Deterministic rather than a pick: it is
 * the funnel's own first arrow, not the cheapest or the best of anything.
 */
export function pricedStep(funnel: ShowcaseFunnel | null): ShowcaseStep | null {
  for (const step of funnel?.steps ?? []) {
    if (step.key === CONTACTED) continue;
    if (typeof step.costPerReachUsd === "number") return step;
  }
  return null;
}

/**
 * One hero card: the client, its logo, and its funnel walked rung by rung.
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
  const steps = measuredSteps(cardFunnel(brand)).slice(0, 4);
  if (steps.length === 0) return null;

  const counts = steps.map((s) => s.peopleReached as number);
  const cells = steps
    .map((step, index) => {
      const value = counts[index];
      const zero = value === 0 ? " data-zero" : "";
      return `<span class="sf" data-step="${esc(step.key)}"${zero}><b data-n="${index}">${formatInt(value)}</b><small>${esc(pluralLabel(step))}</small></span>`;
    })
    .join("\n            ");

  return `<a class="show-card" href="#proof" data-live data-brand="${esc(domain)}" data-steps="${counts.join(",")}">
          <div class="show-top"><img src="${logoUrl(domain, 64)}" alt="" width="32" height="32"><div><div class="show-name">${esc(name)}</div><div class="show-domain">${esc(domain)}</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            ${cells}
          </div>
        </a>`;
}

/**
 * One proof card: who they are, what they got back, what one outcome cost them, and the
 * funnel behind it.
 *
 * The person leads when we have met them and the COMPANY leads when we have not — never
 * an invented name against a stock face. See `showcase-people.ts` for why an unnamed
 * client is drawn rather than skipped.
 */
export function renderProofCard(brand: ShowcaseBrand): string | null {
  const domain = brand.brand?.domain;
  const name = brand.brand?.name;
  if (!domain || !name) return null;
  const funnel = cardFunnel(brand);
  const roi = typeof funnel?.returnPerDollar === "number" ? funnel.returnPerDollar : null;
  if (roi === null) return null;

  const shaped = formatReturnMultiple(roi);
  const person = personFor(domain);
  const top = person
    ? `<div class="proof-top"><img class="face" src="${person.photo}" alt=""><div><div class="name">${esc(person.name)}</div><div class="meta">${esc(person.role)}</div></div></div>`
    : `<div class="proof-top"><img class="face" src="${logoUrl(domain, 128)}" alt=""><div><div class="name">${esc(name)}</div><div class="meta">${esc(domain)}</div></div></div>`;

  const priced = pricedStep(funnel);
  const costLine = priced
    ? `\n        <div class="proof-line" data-proof-cost-step="${esc(priced.key)}"><span>Cost per ${esc(singularLabel(priced))}</span><b>${formatCostUsd(priced.costPerReachUsd as number)}</b></div>`
    : "";

  // A rung nobody reached is LEFT OUT of a proof card rather than drawn at zero. The hero
  // card hides it instead, because `main.js` climbs those counters and has to be able to
  // reveal the cell; nothing animates here, so an empty rung would just sit there stating
  // a zero about a client.
  const rungs = measuredSteps(funnel)
    .filter((step) => (step.peopleReached as number) > 0)
    .slice(0, 3)
    .map(
      (step) =>
        `<span data-proof-step="${esc(step.key)}"><b>${formatInt(step.peopleReached as number)}</b>${esc(singularLabel(step) === "contact" ? "contacted" : pluralLabel(step).toLowerCase())}</span>`
    )
    .join("");

  return `<article class="proof-card rv" data-proof-brand="${esc(domain)}" data-proof-funnel="${esc(funnel?.funnelKey ?? "")}">
        ${top}
        <div class="proof-roi"><span class="big" data-count="${shaped.text}" data-decimals="${shaped.decimals}">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>${costLine}
        <div class="proof-funnel">${rungs}</div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>`;
}

/**
 * WHERE EACH OF THE TOP THREE SITS ON THE ROW: best on the left, third in the middle,
 * second on the right.
 *
 * Owner-picked. It is a LAYOUT decision over an order the producer already stated, never
 * a re-ranking: the producer's first is still the first, it is simply drawn first rather
 * than drawn in the middle. A row that re-sorted here would be this page holding an
 * opinion about whose numbers are best, which is the one thing it must not do.
 */
export const PODIUM_ORDER: readonly number[] = [0, 2, 1];

/** Lay a producer-ordered list out on the podium, keeping every member. */
export function podium<T>(items: readonly T[]): T[] {
  if (items.length !== PODIUM_ORDER.length) return [...items];
  return PODIUM_ORDER.map((index) => items[index]);
}
