// The offer levers we walk the user through right after payment — one screen
// per lever — so the emails we write convert. Each lever is one term of Alex
// Hormozi's value equation (mirrors the strategy page's "What we use to
// optimize your conversion"). Keys map to SALES_PROFILE_FIELDS so the value is
// AI-prefilled from the brand's site; the user just confirms or tweaks it.
//
// "Services sold" is intentionally NOT here — it is already collected in the
// pre-payment services step. Copy is user-facing: keep it plain, no em-dash.

export type OfferLever = {
  /** SALES_PROFILE_FIELDS key — the profile field this lever reads/writes. */
  key: string;
  /** Step title. */
  title: string;
  /** One line on why this lever matters for conversion. */
  why: string;
  /** Input placeholder when the field came back empty. */
  placeholder: string;
};

export const POST_PAYMENT_OFFER_LEVERS: ReadonlyArray<OfferLever> = [
  {
    key: "valueProposition",
    title: "Dream outcome",
    why: "The result your buyer wants. We write every email around this promise, so make it specific and worth wanting.",
    placeholder: "The transformation you deliver for your customers.",
  },
  {
    key: "perceivedLikelihood",
    title: "Perceived likelihood of success",
    why: "Prospects need to believe they will get the result. Proof lifts that belief: track record, numbers, guarantees, named results.",
    placeholder: "Why prospects can trust they will get the outcome.",
  },
  {
    key: "socialProof",
    title: "Social proof",
    why: "Recognizable clients and concrete results make the promise credible instead of a claim.",
    placeholder: "Case studies, testimonials, notable clients, hard results.",
  },
  {
    key: "riskReversal",
    title: "Risk reversal",
    why: "Removing the downside makes saying yes easy. A guarantee or refund lowers the perceived risk.",
    placeholder: "Guarantees, trials, refund policy, done-with-you support.",
  },
  {
    key: "urgency",
    title: "Urgency",
    why: "A reason to act now instead of later. Real time pressure moves replies.",
    placeholder: "Deadlines, cohorts, seasonal windows, time-boxed offers.",
  },
  {
    key: "scarcity",
    title: "Scarcity",
    why: "Limited availability raises perceived value. Only use what is true.",
    placeholder: "Limited seats, waitlist, capped capacity.",
  },
];
