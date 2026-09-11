/**
 * WHICH MODEL A WORKFLOW WRITES WITH, AND WHOSE IT IS.
 *
 * A workflow's DAG names a chat-service model ALIAS (`flash-pro`, `deepseek-pro`,
 * `fable`) on its content-generation call, and workflow-service derives that alias
 * onto every catalogue row (`contentModel`). The alias is a token; a customer reading
 * a table wants a name and a mark. This is the one place that turns one into the
 * other, and it decides exactly two things: what the alias is CALLED, and whose LOGO
 * sits beside it.
 *
 * ── THE LABEL NAMES THE FAMILY AND THE TIER, NEVER THE VERSION ───────────────────
 *
 * It would read better to print the model the alias resolves to — `Gemini 3.8 Flash`,
 * `Claude Fable 5.1`. That number is exactly the thing that moves: chat-service walked
 * `flash-pro` from Gemini 3.5 to 3.7 to 3.8 inside one year, and every one of those
 * moves would have left a stale version on this screen with nothing going red. So the
 * label is the alias's own words in the vendor's — `Gemini Flash Pro` for `flash-pro`
 * — which is a statement about WHAT THE WORKFLOW ASKED FOR, and the workflow asked for
 * the alias. That claim cannot rot, because the alias is what is stored.
 *
 * It also keeps us honest where the alias and the model genuinely disagree:
 * `deepseek-pro` is a deprecated synonym that chat-service resolves to the SAME model
 * as `deepseek-flash`. Printing `DeepSeek Pro` states the DAG; printing a resolved
 * model name would claim a model that does not run.
 *
 * ── AN UNKNOWN ALIAS KEEPS ITS OWN TEXT AND DRAWS NO LOGO ────────────────────────
 *
 * chat-service adds aliases (six providers today, and `gpt-pro` arrived after the
 * other five). An alias this catalogue has never heard of renders VERBATIM with no
 * mark — the same rule `CHANNEL_MARKS` already follows: a mark we would have to invent
 * is worse than none, and a guessed provider would attribute a customer's spend to the
 * wrong company. A null model renders nothing at all, which the caller states as `—`;
 * it is never defaulted to a tier.
 *
 * Alias-free (no imports at all) so it carries real unit tests. Keep it that way.
 */

/** A model as a reader should see it: what it is called, and whose it is. */
export interface WorkflowModelMark {
  /** The alias exactly as the workflow states it. */
  alias: string;
  /** Family + tier, in the vendor's words. The alias verbatim when unknown. */
  label: string;
  /** For `ProviderLogo`. Null for an alias no catalogue entry covers — no mark drawn. */
  providerDomain: string | null;
}

/**
 * Every alias chat-service exposes, grouped by the provider that serves it — the same
 * six families its own `MODELS_BY_PROVIDER` lists.
 */
const MODEL_MARKS: Readonly<Record<string, { label: string; providerDomain: string }>> = {
  // Anthropic
  haiku: { label: "Claude Haiku", providerDomain: "anthropic.com" },
  sonnet: { label: "Claude Sonnet", providerDomain: "anthropic.com" },
  opus: { label: "Claude Opus", providerDomain: "anthropic.com" },
  fable: { label: "Claude Fable", providerDomain: "anthropic.com" },
  // Google Gemini
  "flash-lite": { label: "Gemini Flash Lite", providerDomain: "google.com" },
  flash: { label: "Gemini Flash", providerDomain: "google.com" },
  "flash-pro": { label: "Gemini Flash Pro", providerDomain: "google.com" },
  pro: { label: "Gemini Pro", providerDomain: "google.com" },
  // DeepSeek
  "deepseek-flash": { label: "DeepSeek Flash", providerDomain: "deepseek.com" },
  "deepseek-pro": { label: "DeepSeek Pro", providerDomain: "deepseek.com" },
  // Z.ai
  "glm-flash": { label: "GLM Flash", providerDomain: "z.ai" },
  "glm-pro": { label: "GLM Pro", providerDomain: "z.ai" },
  // Moonshot
  "kimi-flash": { label: "Kimi Flash", providerDomain: "moonshot.ai" },
  "kimi-pro": { label: "Kimi Pro", providerDomain: "moonshot.ai" },
  // OpenAI
  "gpt-pro": { label: "GPT Pro", providerDomain: "openai.com" },
};

/**
 * The mark for a workflow's stated model, or null when it states none.
 *
 * Null is the honest answer for a workflow whose content-generation call names no
 * model (workflow-service serves `contentModel: null` for half the live channel) —
 * the caller renders its own "we have no figure" word rather than a default tier.
 */
export function workflowModelMark(
  contentModel: string | null | undefined,
): WorkflowModelMark | null {
  const alias = contentModel?.trim();
  if (!alias) return null;
  const known = MODEL_MARKS[alias];
  if (!known) return { alias, label: alias, providerDomain: null };
  return { alias, label: known.label, providerDomain: known.providerDomain };
}

/** The aliases this catalogue covers — for tests and for a coverage check. */
export function knownModelAliases(): string[] {
  return Object.keys(MODEL_MARKS);
}
