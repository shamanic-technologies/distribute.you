/**
 * Staff status of a template or a writer model on the Research pages (TEMPLATE-MODEL-STATUS-1019):
 * the lookups only. Every status is content-generation-service's; this module NAMES it and joins
 * served keys, it never decides one. Alias-free so it carries real unit tests.
 */
import { PIPE_ORDER, type ResearchCatalog, type ResearchModel, type ResearchPipe } from "./research";

/**
 * What a deprecation acts on: a template TYPE, or every model ALIAS a concrete model is served under
 * (never the concrete id: content-generation-service sets a status per alias).
 */
export type ContentTarget = { kind: "template"; key: string; label: string } | { kind: "model"; aliases: string[]; label: string };

/** A model's status over its aliases: Deprecated only once every one is; null while any is unstated. */
export function modelStatus(aliases: readonly string[], statusOf: (alias: string) => string | null | undefined): string | null {
  if (aliases.length === 0) return null;
  const all = aliases.map(statusOf);
  if (all.some((x) => x == null)) return null;
  return all.every((x) => x === "deprecated") ? "deprecated" : "active";
}

/** A served status as the word a row prints, or null when nothing states one. */
export function statusWord(status: string | null | undefined): "Active" | "Deprecated" | null {
  if (status === "active") return "Active";
  if (status === "deprecated") return "Deprecated";
  if (status != null) console.error("[dashboard] research status: unknown status word", { status });
  return null;
}

/**
 * The ALIASES a model's status is set on, as features-service serves them on its Research row (read
 * off chat-service's own alias list): `glm-5.3` is `glm-pro`, and one model can be served under two
 * (`deepseek-v4.1-flash` is `deepseek-flash` and `deepseek-pro`, both acted on). Never guessed from
 * the workflows: a model no workflow writes with today still has its aliases.
 * `gap` is the plain sentence a row prints when there is none, so a status is never blank.
 */
export function modelAliasesOf(m: Pick<ResearchModel, "key" | "aliases" | "aliasesUnavailableReason">): { aliases: string[]; gap: string | null } {
  if (m.aliases === undefined) return { aliases: [], gap: "Not stated yet" };
  if (m.aliases.length > 0) return { aliases: m.aliases, gap: null };
  const reason = m.aliasesUnavailableReason ?? null;
  if (reason === "no_alias_serves_it") return { aliases: [], gap: "Retired: no alias uses it now" };
  if (reason === "model_not_in_chat_service") return { aliases: [], gap: "Not served by chat-service" };
  if (reason === "model_ids_unreadable") return { aliases: [], gap: "chat-service unreadable now" };
  console.error("[dashboard] research model: no alias and no reason", { key: m.key, reason });
  return { aliases: [], gap: "No alias stated" };
}

/** "deepseek-flash and deepseek-pro": the aliases a model write changes, named for the confirm. */
export function aliasList(aliases: readonly string[]): string {
  return aliases.length <= 1 ? (aliases[0] ?? "") : `${aliases.slice(0, -1).join(", ")} and ${aliases[aliases.length - 1]}`;
}

/**
 * The pipes (legs) a template writes for: every pipe whose Research catalogue lists it, the
 * current pipe first, then the catalogue's order.
 */
export function templatePipes(catalog: ResearchCatalog | null, key: string, current: ResearchPipe): ResearchPipe[] {
  if (!catalog) return [];
  const on = PIPE_ORDER.filter((p) => (catalog[p]?.templates ?? []).some((t) => t.key === key));
  return on.includes(current) ? [current, ...on.filter((p) => p !== current)] : on;
}
