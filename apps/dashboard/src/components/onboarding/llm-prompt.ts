// Ready-to-paste prompts for the onboarding steps that ask a human to write
// something. A reader who wants help hands the whole question to their own LLM
// (ChatGPT, Claude, ...), gets a tighter answer, and pastes it back.
//
// TWO WAYS TO GET THE SAME TEXT, and the second one is the one people already try.
//
// A drag-selection genuinely cannot span page prose AND the value of an
// `<input>`/`<textarea>`: a form field is a separate editing context, so the
// highlight stops at its edge (measured in Chromium, and the same holds for a
// `contenteditable` under a real mouse drag). What does NOT follow, and what an
// earlier version of this comment wrongly claimed, is that Ctrl+C is therefore
// beyond saving. The `copy` EVENT fires on the surrounding block whatever the
// selection covers, and its handler owns the clipboard: `copyStepIntent` below
// decides when to rewrite it, so selecting the question and pressing Ctrl+C
// hands over the question AND the field, which is precisely the gesture people
// were reaching for and failing at.
//
// So the button is the discoverable path and the copy handler rescues the
// intuitive one. Both put the SAME string on the clipboard, from the builders
// here, because two spellings of one answer is how the two paths come to
// disagree.
//
// Alias-free ON PURPOSE so it carries real unit tests — vitest does not resolve
// the `@` alias in this repo. Keep it that way: a runtime `@/…` import here turns
// its unit tests into resolution failures.
//
// Copy is user-facing: keep it plain, no em-dash.

/** The line every prompt opens with, so the model answers about THIS business. */
function businessLine(domain: string): string {
  return `I run this business: ${domain}`;
}

const CAMPAIGN_LINE =
  "I'm setting up a cold-email campaign with a done-for-you agency and need to fill in one part of my setup.";

/** `(nothing yet)` rather than an empty line, so the model is told there is no
 *  draft instead of being handed a blank it might read as an instruction. */
function draftOr(value: string): string {
  return value.trim() ? value.trim() : "(nothing yet)";
}

function joinPrompt(lines: string[]): string {
  return lines.join("\n");
}

/** Services step: the list of things the brand sells, one per line. `current` is
 *  whatever chips are on screen (AI-drafted from the site, or hand-typed). */
export function buildServicesLLMPrompt(services: string[], domain: string): string {
  return joinPrompt([
    businessLine(domain),
    "",
    CAMPAIGN_LINE,
    "",
    "Question: What services do I want to promote?",
    "These are the offers the outreach will pitch, so they need to be the things I actually sell and want more of.",
    "",
    `My current list: ${draftOr(services.join("\n"))}`,
    "",
    "Rewrite the list so each line is one concrete, sellable service a buyer would recognise.",
    "Use real details about my business. Keep each line under 6 words. 3 to 8 lines.",
    "Return only the list, one service per line, nothing else.",
  ]);
}

/** Audiences step: the plain-words description of the ideal customer that the
 *  audience generator turns into targeting filters. */
export function buildAudienceLLMPrompt(
  prompt: string,
  services: string[],
  domain: string,
): string {
  const sells = services.length ? services.join(", ") : "(not stated yet)";
  return joinPrompt([
    businessLine(domain),
    "",
    CAMPAIGN_LINE,
    "",
    "Question: Who do I want to reach?",
    "This description is turned into a targeted list of real people to email, so it needs job titles, company type, company size and geography.",
    "",
    `What I sell: ${sells}`,
    `My current description: ${draftOr(prompt)}`,
    "",
    "Rewrite it as one sentence naming the job titles, the kind of company, the company size band and the country or region.",
    "Use real details about my business. Do not invent an industry I did not mention.",
    "Return only the rewritten description, nothing else.",
  ]);
}

/** One conversion rate the funnel asks for: the label as the reader sees it and
 *  whatever is currently in the box. */
export type RateAsk = { label: string; value: string };

/** One destination the funnel asks for (a landing page, a booking link). */
export type DestinationAsk = { label: string; value: string; optional: boolean };

/** The funnel-economics steps (`funnelStats`, and the "Your numbers" block on
 *  `model`). Every field is a NUMBER or a URL the reader has to transcribe back
 *  into its own box, so the answer is asked for as one labelled value per line
 *  rather than as prose. */
export function buildFunnelStatsLLMPrompt(input: {
  funnelTitle: string;
  steps: string[];
  rates: RateAsk[];
  lifetimeRevenue: string;
  destinations: DestinationAsk[];
  services: string[];
  domain: string;
}): string {
  const { funnelTitle, steps, rates, lifetimeRevenue, destinations, services, domain } = input;
  const path = steps.length ? steps.join(" -> ") : funnelTitle;
  const lines = [
    businessLine(domain),
    "",
    CAMPAIGN_LINE,
    "",
    `Question: What is this path worth to me, and where does it send people?`,
    `The path: ${funnelTitle} (${path})`,
    "These numbers decide what one customer is worth and therefore how much the campaign can spend to win one, so a wrong number here prices the whole campaign wrong.",
    "",
    `What I sell: ${services.length ? services.join(", ") : "(not stated yet)"}`,
    "",
    "My current values:",
    ...rates.map((r) => `- ${r.label}: ${draftOr(r.value)}`),
    `- Lifetime revenue per paid client (USD): ${draftOr(lifetimeRevenue)}`,
  ];
  for (const dest of destinations) {
    lines.push(`- ${dest.label}${dest.optional ? " (optional)" : ""}: ${draftOr(dest.value)}`);
  }
  lines.push(
    "",
    "Correct anything that looks wrong for a business like mine and fill anything missing.",
    "Percentages are whole numbers without the percent sign. Lifetime revenue is a plain number of US dollars, no currency symbol.",
    "If you cannot tell what a destination URL should be, leave it as it is.",
    "Return only the same labelled lines with the corrected values, nothing else.",
  );
  return joinPrompt(lines);
}


// ── Ctrl+C on a step ────────────────────────────────────────────────────────

/** What the `copy` handler sees at the moment the event fires. Passed in rather
 *  than read here so the decision is pure and unit-testable. */
export type CopyContext = {
  /** Is the focused element the step's own `<input>`/`<textarea>`? */
  activeElementIsField: boolean;
  /** Does that field hold a real (non-collapsed) selection of its own? */
  fieldSelectionIsRange: boolean;
  /** `window.getSelection().toString()` — empty when the selection lives inside
   *  a form field, which is exactly the case the flag above disambiguates. */
  selectionText: string;
};

/**
 * Whether a `copy` on a step should be REWRITTEN to the full question-and-answer
 * prompt, or left alone.
 *
 * Two passthroughs, and both are the point — a handler that always rewrites is
 * worse than none, because it silently steals a copy the reader meant for
 * something else:
 *
 *  - A copy that ORIGINATED INSIDE the field is the reader lifting a fragment of
 *    their own draft (a phrase, a URL from a destination box) to paste
 *    elsewhere. Measured: an unguarded handler hands them the whole prompt
 *    instead of the five characters they selected.
 *  - An EMPTY selection means there is nothing to act on, so there is no
 *    intention to read.
 *
 * Everything else is somebody selecting the question, or the hint, or the whole
 * block, and pressing Ctrl+C. That is the gesture this exists to answer.
 */
export function copyStepIntent(ctx: CopyContext): "rewrite" | "passthrough" {
  if (ctx.activeElementIsField && ctx.fieldSelectionIsRange) return "passthrough";
  if (!ctx.selectionText.trim()) return "passthrough";
  return "rewrite";
}
