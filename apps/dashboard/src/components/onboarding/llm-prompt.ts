// The offer card's "Copy all for LLM": a ready-to-paste prompt a reader hands to
// their own LLM (ChatGPT, Claude, ...) to get a tighter offer back.
//
// Alias-free ON PURPOSE so it carries real unit tests: vitest does not resolve
// the `@` alias in this repo.
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

/** One lever of the offer card as it reads on screen: its label, the one-line
 *  hint under it, and the value in the field right now (a draft included). */
export type OfferPromptLever = { label: string; tip: string; value: string };

/** The offer page's "Copy all for LLM": every Hormozi lever at once, with what is
 *  in each field now, so the reader gets one tighter version of the WHOLE offer
 *  back instead of asking seven times. Same headings in and out, so each answer
 *  pastes back under its own field. */
export function buildOfferLLMPrompt(levers: OfferPromptLever[], domain: string): string {
  const blocks = levers.flatMap((l) => [`## ${l.label}`, `(${l.tip})`, draftOr(l.value), ""]);
  return joinPrompt([
    businessLine(domain),
    "",
    "I'm setting up a cold-email campaign with a done-for-you agency. They write every email around my offer, framed with Alex Hormozi's value equation.",
    "",
    "Here is my offer as it stands, one part per heading:",
    "",
    ...blocks,
    "Rewrite each part so it is specific, concrete, and believable for a cold email.",
    "Use real details about my business. Keep each part to 1-3 short sentences; for lists, one item per line.",
    "Keep the same headings in the same order, and return only the headings and the rewritten text.",
  ]);
}
