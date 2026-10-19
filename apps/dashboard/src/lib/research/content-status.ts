/**
 * Staff status of a template or a writer model on the Research pages (TEMPLATE-MODEL-STATUS-1019):
 * the lookups only. Every status is content-generation-service's; this module NAMES it and joins
 * served keys, it never decides one. Alias-free so it carries real unit tests.
 */
import { PIPE_ORDER, type ResearchCatalog, type ResearchPipe } from "./research";

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
 * The concrete model id Research lists a model under (`glm-5.3`) -> the ALIASES its status is set on
 * (`glm-pro`; one concrete model can be served under two, `deepseek-v4.1-flash` is both
 * `deepseek-flash` and `deepseek-pro` on 2026-10-19), read off what each runnable workflow writes with
 * now (features-service `writesWithNow.model.key` + `modelAlias`). A model no runnable workflow writes
 * with has no alias here, so its row states no status: nothing runs on it to stop.
 */
export function modelAliases(catalog: ResearchCatalog | null): Map<string, string[]> {
  const out = new Map<string, string[]>();
  if (!catalog) return out;
  for (const pipe of PIPE_ORDER) {
    for (const w of catalog[pipe]?.workflows ?? []) {
      const now = w.writesWithNow;
      if (!now?.model?.key || !now.modelAlias) continue;
      const list = out.get(now.model.key) ?? [];
      if (!list.includes(now.modelAlias)) out.set(now.model.key, [...list, now.modelAlias].sort());
    }
  }
  return out;
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
