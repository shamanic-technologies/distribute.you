/**
 * WHICH PRODUCT MARK AN LLM WEARS (owner 2026-10-22: « chaque LLM ait son logo »).
 *
 * One display lookup for every surface that names a model: a served public name ("Claude Opus 5.5",
 * "GLM-5.3", "GPT-6 Astra"), a chat-service model id ("gemini-3.8-flash"), a workflow's alias
 * ("flash-pro", "fable") or chat-service's vendor id when the read carries one. It decides two
 * things only: the PRODUCT mark (Claude's starburst, Gemini's sparkle, never the company's logo,
 * owner 2026-10-19) and the label beside it (the family word dropped when the mark already says it).
 *
 * The families are chat-service's providers (`/internal/model-dynasties`, 2026-10-22: anthropic,
 * google, deepseek, zai, moonshot, openai) plus the two whose marks we already ship. A name no family
 * claims returns `logo: null`: the caller draws the neutral mark and logs it, never a guessed vendor.
 *
 * Alias-free (no imports) so it carries real unit tests.
 */

export interface LlmMark {
  /** Text beside the mark: "Opus 5.5" beside Claude's, "3.8 Flash" beside Gemini's; verbatim otherwise. */
  label: string;
  /** The name as served, whole, for the hover. */
  name: string;
  /** The product mark we ship under `public/model-logos`; null = unknown family. */
  logoSrc: string | null;
  /** The family word ("Claude"), null when unknown. */
  family: string | null;
}

interface Family {
  family: string;
  logo: string;
  /** chat-service vendor ids. */
  vendors: readonly string[];
  /** Lower-case words a name or id may open on (followed by a space, a dash or the end). */
  prefixes: readonly string[];
  /** Bare chat-service aliases that name this family without its word. */
  aliases: readonly string[];
}

const FAMILIES: readonly Family[] = [
  { family: "Claude", logo: "claude", vendors: ["anthropic"], prefixes: ["claude"], aliases: ["haiku", "sonnet", "opus", "fable"] },
  { family: "Gemini", logo: "gemini", vendors: ["google"], prefixes: ["gemini"], aliases: ["flash", "flash-lite", "flash-pro", "pro"] },
  { family: "GPT", logo: "openai", vendors: ["openai"], prefixes: ["gpt"], aliases: [] },
  { family: "DeepSeek", logo: "deepseek", vendors: ["deepseek"], prefixes: ["deepseek"], aliases: [] },
  { family: "GLM", logo: "glm", vendors: ["zai"], prefixes: ["glm"], aliases: [] },
  { family: "Kimi", logo: "kimi", vendors: ["moonshot"], prefixes: ["kimi"], aliases: [] },
  { family: "Mistral", logo: "mistral", vendors: ["mistral"], prefixes: ["mistral"], aliases: [] },
  { family: "Grok", logo: "grok", vendors: ["xai"], prefixes: ["grok"], aliases: [] },
];

function opensOn(lower: string, prefix: string): boolean {
  if (!lower.startsWith(prefix)) return false;
  const next = lower.charAt(prefix.length);
  return next === "" || next === " " || next === "-";
}

function familyOf(lower: string, vendorId: string | null | undefined): Family | null {
  if (vendorId) {
    const byVendor = FAMILIES.find((f) => f.vendors.includes(vendorId));
    if (byVendor) return byVendor;
  }
  return FAMILIES.find((f) => f.prefixes.some((p) => opensOn(lower, p)) || f.aliases.includes(lower)) ?? null;
}

/** The mark and label for one model, whichever way the read names it. */
export function llmMark(name: string, vendorId?: string | null): LlmMark {
  const trimmed = name.trim();
  const f = familyOf(trimmed.toLowerCase(), vendorId);
  if (!f) return { label: trimmed, name: trimmed, logoSrc: null, family: null };
  // Only a "Family rest" name drops its word: "GLM-5.3" or a bare alias keeps its text whole.
  const prefix = `${f.family} `;
  const label = trimmed.startsWith(prefix) && trimmed.length > prefix.length ? trimmed.slice(prefix.length) : trimmed;
  return { label, name: trimmed, logoSrc: `/model-logos/${f.logo}.svg`, family: f.family };
}

/** Every product mark the lookup names, for the test that each file ships. */
export function llmLogoFiles(): string[] {
  return FAMILIES.map((f) => `${f.logo}.svg`);
}
