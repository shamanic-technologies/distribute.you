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

// Lever keys whose brand-profile field is LIST-kind (string[]). socialProof is the
// only list lever in the post-payment set ("services" is a list too but is collected
// in the pre-payment services step, not here). Writing one of these back as the raw
// <textarea> string clobbers the array — saveBrandProfileVersion then persists a
// string and the Strategy page's ListEditor renders it EMPTY — so the offer step must
// split the text into items. Mirrors SALES_PROFILE_FIELDS' kind:"list".
const LIST_LEVER_KEYS: ReadonlySet<string> = new Set(["socialProof"]);

/** Is this offer lever a list-kind field (must be persisted as string[])? */
export function isListLever(key: string): boolean {
  return LIST_LEVER_KEYS.has(key);
}

/** The <textarea> string for a list lever — one item per line, so the round-trip
 *  with parseListLeverInput is lossless. Accepts a legacy string or the array. */
export function formatListLeverValue(value: string | string[] | undefined | null): string {
  if (Array.isArray(value)) return value.join("\n");
  return typeof value === "string" ? value : "";
}

/** Split a list lever's <textarea> content into trimmed, non-empty items so the
 *  profile keeps socialProof a string[] — never a clobbered bare string. */
export function parseListLeverInput(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

// Build a ready-to-paste prompt so a user who wants help can hand this exact
// offer question to their own LLM (ChatGPT, Claude, ...), get a tighter answer,
// and paste it back into the field. `current` is whatever is already in the
// textarea (AI-prefilled from the site or hand-edited). Keep plain, no em-dash.
export function buildLeverLLMPrompt(
  lever: OfferLever,
  current: string,
  domain: string,
): string {
  const draft = current.trim() ? current.trim() : "(nothing yet)";
  return [
    `I run this business: ${domain}`,
    "",
    "I'm setting up a cold-email campaign and need to nail one part of my offer.",
    "",
    `Question: ${lever.title}`,
    lever.why,
    "",
    `My current draft: ${draft}`,
    "",
    "Rewrite it so it is specific, concrete, and believable for a cold email.",
    "Use real details about my business. Keep it to 1-3 short sentences.",
    "Return only the rewritten text, nothing else.",
  ].join("\n");
}
