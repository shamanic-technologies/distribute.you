/**
 * The Catalogue page (owner 2026-11-07, every client; the GTM Factory preview's Catalogue): the outcomes, one Engine per
 * outcome, the scripts competing in each Engine, the tactics and the strategies. Shapes as their producers serve them
 * (workflow-service `GET /scripts` through the gateway's `/v1/scripts`; features-service `/internal/catalogue/tactics|
 * strategies` through `/v1/catalogue/*`). Grouping only, never a figure computed here. Alias-free so it carries unit tests.
 */
import { z } from "zod";

export const ScriptSchema = z
  .object({
    id: z.string(),
    outcome: z.string(),
    dynasty: z.string(),
    version: z.number(),
    scriptSlug: z.string(),
    description: z.string(),
    materials: z.array(z.string()),
    vendors: z.array(z.string()),
    status: z.enum(["active", "deprecated"]),
    dynastyStatus: z.enum(["active", "deprecated"]),
    runnable: z.boolean(),
    replay: z.object({ cases: z.number(), matches: z.number() }).passthrough().nullish(),
    cases: z.number().nullish(),
    createdAt: z.string(),
  })
  .passthrough();
export type Script = z.infer<typeof ScriptSchema>;
export const ScriptListSchema = z.object({ scripts: z.array(ScriptSchema) }).passthrough();

export const CatalogueTacticSchema = z
  .object({ id: z.string(), name: z.string(), description: z.string(), clientLine: z.string().nullish(), appliesTo: z.string().nullish() })
  .passthrough();
export type CatalogueTactic = z.infer<typeof CatalogueTacticSchema>;

const NamedRef = z.object({ id: z.string(), name: z.string() }).passthrough();
export const CatalogueStrategySchema = z
  .object({ id: z.string(), name: z.string(), description: z.string(), requires: z.array(NamedRef), excludes: z.array(NamedRef) })
  .passthrough();
export type CatalogueStrategy = z.infer<typeof CatalogueStrategySchema>;

export const CatalogueRowsSchema = <T extends z.ZodTypeAny>(row: T) =>
  z.object({ total: z.number(), truncated: z.boolean(), rows: z.array(row) }).passthrough();

/** One script per live dynasty: its newest active version (a deprecated dynasty runs nothing and is left out). */
export function dynastyHeads(scripts: Script[]): Script[] {
  const heads = new Map<string, Script>();
  for (const s of scripts) {
    if (s.dynastyStatus !== "active" || s.status !== "active") continue;
    const key = `${s.outcome}/${s.dynasty}`;
    const prev = heads.get(key);
    if (!prev || s.version > prev.version) heads.set(key, s);
  }
  return [...heads.values()];
}

export interface Engine {
  outcome: string;
  /** The live dynasties competing in it, newest version each. */
  heads: Script[];
  /** Every outcome its scripts ask their Providers for, once each, in first-seen order. */
  materials: string[];
}

/** One Engine per outcome that has a live script, in the outcomes' served order (unknown outcomes after). */
export function enginesOf(scripts: Script[], outcomeOrder: string[]): Engine[] {
  const by = new Map<string, Script[]>();
  for (const h of dynastyHeads(scripts)) by.set(h.outcome, [...(by.get(h.outcome) ?? []), h]);
  const rank = (o: string) => {
    const i = outcomeOrder.indexOf(o);
    return i === -1 ? outcomeOrder.length : i;
  };
  return [...by.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([outcome, heads]) => ({
      outcome,
      heads: heads.sort((a, b) => a.dynasty.localeCompare(b.dynasty)),
      materials: [...new Set(heads.flatMap((h) => h.materials))],
    }));
}

/** A dynasty slug read as words: `cold-email-writer` → "Cold email writer". */
export function dynastyName(dynasty: string): string {
  const words = dynasty.replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : dynasty;
}

export const CATALOGUE_TABS = ["outcomes", "engines", "scripts", "tactics", "strategies"] as const;
export type CatalogueTab = (typeof CATALOGUE_TABS)[number];
export const CATALOGUE_TAB_LABELS: Record<CatalogueTab, string> = {
  outcomes: "Outcomes",
  engines: "Engines",
  scripts: "Scripts",
  tactics: "Tactics",
  strategies: "Strategies",
};
export function catalogueTabOf(raw: string | null): CatalogueTab {
  return raw && (CATALOGUE_TABS as readonly string[]).includes(raw) ? (raw as CatalogueTab) : "outcomes";
}
