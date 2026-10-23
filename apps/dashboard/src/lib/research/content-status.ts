/**
 * Staff status of a template or a writer model on the Research pages (TEMPLATE-MODEL-STATUS-1019):
 * the lookups only. Every status is content-generation-service's; this module NAMES it and joins
 * served keys, it never decides one. Alias-free so it carries real unit tests.
 */
import { catalogPipes, pipeCatalog, type ResearchCatalog, type ResearchModel, type ResearchPipe } from "./research";

/**
 * What a deprecation acts on: a template TYPE, or every model ALIAS a concrete model is served under
 * (never the concrete id: content-generation-service sets a status per alias).
 */
export type ContentTarget =
  | { kind: "template"; key: string; label: string }
  | { kind: "model"; aliases: string[]; label: string; pipe: ModelPipe; researchPipe: ResearchPipe };

/**
 * The ONE pipe a model status is read and written on (LLM-STATUS-PER-PIPE-1023, owner 2026-10-23:
 * « la deprecation manuelle doit être par pipe »): the channel (feature slug) x the leg.
 */
export type ModelPipe = { featureSlug: string; legKey: string };

/** A model alias's status row as content-generation-service serves it: one entry per pipe staff stated a status on. */
export type ModelPipeStatuses = {
  pipeStatuses: readonly {
    featureSlug: string;
    legKey: string;
    status: string;
    statusReason: string | null;
    statusChangedBy: string | null;
    statusChangedAt: string | null;
  }[];
};

/**
 * An alias's status on ONE pipe: the pipe's entry, else `active` (the producer's rule: no entry =
 * active there). Another pipe's entry never counts.
 */
export function modelStatusOnPipe(row: ModelPipeStatuses, pipe: ModelPipe): { status: string; deprecation: DeprecationFacts | null } {
  const e = row.pipeStatuses.find((p) => p.featureSlug === pipe.featureSlug && p.legKey === pipe.legKey);
  if (!e) return { status: "active", deprecation: null };
  return { status: e.status, deprecation: contentDeprecation(e) };
}

/** A model's status over its aliases: Deprecated only once every one is; null while any is unstated. */
export function modelStatus(aliases: readonly string[], statusOf: (alias: string) => string | null | undefined): string | null {
  if (aliases.length === 0) return null;
  const all = aliases.map(statusOf);
  if (all.some((x) => x == null)) return null;
  return all.every((x) => x === "deprecated") ? "deprecated" : "active";
}

/**
 * The Models list's two tabs (owner 2026-10-23, like Templates and Workflows): Deprecated once every
 * alias it is served under is, or when no alias serves it now (it cannot write); Active otherwise.
 * Null until the statuses answer, so no row lands in a tab it then leaves.
 */
export function modelsByTab<T extends Pick<ResearchModel, "key" | "aliases" | "aliasesUnavailableReason">>(
  rows: readonly T[],
  statuses: { answered: boolean; map: ReadonlyMap<string, string> },
): Record<"active" | "deprecated", T[]> | null {
  if (!statuses.answered) return null;
  const out: Record<"active" | "deprecated", T[]> = { active: [], deprecated: [] };
  for (const m of rows) {
    const { aliases } = modelAliasesOf(m);
    const dead = aliases.length === 0 || modelStatus(aliases, (a) => statuses.map.get(a)) === "deprecated";
    out[dead ? "deprecated" : "active"].push(m);
  }
  return out;
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
  const on = catalogPipes(catalog).filter((p) => pipeCatalog(catalog, p).templates.some((t) => t.key === key));
  return on.includes(current) ? [current, ...on.filter((p) => p !== current)] : on;
}

/** Why, who and when, as a producer serves a deprecation (DEPRECATION-REASON-1020). */
export type DeprecationFacts = { reason: string; decidedBy: string | null; decidedAt: string | null };

/**
 * "Catch-all copy of Azha: ... (kevin@distribute.you, 2026-10-20)": the reason, then who and the
 * day it was decided, each only when served. "Not specified" (deprecated before reasons existed)
 * prints as is; an unknown who or when prints nothing, never a guess.
 */
export function deprecationLine(d: DeprecationFacts): string {
  const day = d.decidedAt && /^\d{4}-\d{2}-\d{2}/.test(d.decidedAt) ? d.decidedAt.slice(0, 10) : null;
  const meta = [d.decidedBy, day].filter((x): x is string => Boolean(x));
  return meta.length ? `${d.reason} (${meta.join(", ")})` : d.reason;
}

/** A template's or model alias's deprecation off its status row; null while it is active. */
export function contentDeprecation(row: {
  status: string;
  statusReason?: string | null;
  statusChangedBy?: string | null;
  statusChangedAt?: string | null;
}): DeprecationFacts | null {
  if (row.status !== "deprecated") return null;
  return { reason: row.statusReason ?? "Not specified", decidedBy: row.statusChangedBy ?? null, decidedAt: row.statusChangedAt ?? null };
}

/**
 * A model's deprecation over its aliases: one line per distinct decision (an alias deprecated on
 * its own keeps its own why). Null unless every alias is deprecated (the model's status rule).
 */
export function modelDeprecation(aliases: readonly string[], deprecationOf: (alias: string) => DeprecationFacts | null): DeprecationFacts[] | null {
  if (aliases.length === 0) return null;
  const all = aliases.map(deprecationOf);
  if (all.some((d) => d == null)) return null;
  const seen = new Set<string>();
  return (all as DeprecationFacts[]).filter((d) => {
    const k = deprecationLine(d);
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
