/**
 * WHAT A WORKFLOW'S PROMPT TEMPLATE IS CALLED.
 *
 * workflow-service derives the template its content-generation call asks for and
 * serves it verbatim (`contentPromptType`, e.g. `blind-discovery-email-v26`). That id
 * is the only template identity on the wire — there is no name, no logo and no
 * catalogue anywhere in the fleet — so a reader gets a token where a table wants a
 * name, exactly as the model alias did before `workflow-model-marks`.
 *
 * ── THE LABEL DROPS THE VERSION, THE ROW STILL PRINTS THE ID ─────────────────────
 *
 * `blind-discovery-email-v26` reads `Blind Discovery Email`. The version is what tells
 * two rows apart, so it is never thrown away — it rides the SECOND line of the cell,
 * the id verbatim. That split is the whole point: line one answers "what is this", line
 * two answers "which one exactly", and a reader who needs to quote it to us has it.
 *
 * ── THE DERIVATION IS MECHANICAL AND IT STOPS THERE ──────────────────────────────
 *
 * Strip a trailing `-v<N>`, split on the separators, title-case the words. Nothing is
 * looked up, expanded or prettified beyond that: a hand-written map of ids to nicer
 * names is a copy of another service's list and rots the day it adds a template — the
 * stale-copy failure this repo keeps recording. An id that survives the strip as an
 * empty string keeps its own text rather than rendering blank.
 *
 * Alias-free (no imports at all) so it carries real unit tests. Keep it that way.
 */

/** A template as a reader should see it: what it is called, and which one exactly. */
export interface WorkflowTemplateLabel {
  /** The id exactly as the workflow states it — the second line, and the join key. */
  id: string;
  /** Title-cased words with the trailing version dropped. The id when nothing is left. */
  label: string;
}

/** A trailing version marker: `-v26`, `_v3`. Only at the END — `v2-email` is a word. */
const TRAILING_VERSION = /[-_]v\d+$/i;

/** Words are separated by a dash, an underscore, a dot or whitespace. */
const SEPARATORS = /[-_.\s]+/;

function titleCaseWord(word: string): string {
  if (!word) return word;
  // An ALL-CAPS token is an acronym somebody meant (`CTA`, `B2B`) — lowering it would
  // be inventing a spelling. Anything else is lowered then capitalised, so `EMAIL`
  // stays `EMAIL` while `Email` and `email` both read `Email`.
  if (word.length > 1 && word === word.toUpperCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * The label for a workflow's stated template, or null when it states none.
 *
 * Null is the honest answer for a workflow whose content-generation call names no
 * template — the caller renders its own "we have no figure" word rather than a
 * fabricated name.
 */
export function workflowTemplateLabel(
  contentPromptType: string | null | undefined,
): WorkflowTemplateLabel | null {
  const id = contentPromptType?.trim();
  if (!id) return null;
  const stem = id.replace(TRAILING_VERSION, "");
  const words = stem.split(SEPARATORS).filter(Boolean).map(titleCaseWord);
  return { id, label: words.length > 0 ? words.join(" ") : id };
}
