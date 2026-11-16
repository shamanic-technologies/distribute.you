import type { ResearchCatalog, ResearchFile } from "@/lib/research/research";
import type { ResearchPerformance } from "@/lib/research/performance";

/**
 * SERVER ONLY. Every byte of Research, read LIVE from features-service through the api-service
 * gateway (staff only: admin key + a staff `x-email`; LIVE-RESEARCH-1018), keyed by Engine and script
 * (RESEARCH-BY-ENGINE-1113, owner 2026-11-13: no pipe anywhere):
 *
 *   GET /v1/features/research/engines?basis=                 the file (studies, Engines and their measures, outcomes)
 *   GET /v1/features/research/engines/catalog?basis=         the script, template and LLM pages per measure
 *   GET /v1/features/research/engines/performance?basis=     the Performance tab per measure
 *   GET /v1/features/research/templates                      the template texts, by template id
 *
 * Every read but the texts also carries `view=mature|flash` (MATURITY-VIEW-1023): which
 * build features-service serves, the staff Mature / Flash switch (`lib/v2/maturity-view-cookie.ts`).
 *
 * No snapshot is kept anywhere: any failure (the 503 `research_not_computed_yet` before
 * features-service's first build included) throws, the route answers it and the page shows its
 * error state, never an older copy.
 */
const API_URL = (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you").replace(/\/$/, "");

export type ResearchBasisParam = "user" | "actual";
export type ResearchViewParam = "mature" | "flash";

/** A read features-service refused, with its status, so the route can answer the same one. */
export class ResearchReadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function readLive<T>(path: string, staffEmail: string): Promise<T> {
  const key = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!key) throw new Error("[research] ADMIN_DISTRIBUTE_API_KEY is not set");
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "X-API-Key": key, "x-email": staffEmail },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ResearchReadError(`[research] ${path} answered ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

/** The live Research file on one cost basis, by Engine. */
export async function readLiveResearch(basis: ResearchBasisParam, view: ResearchViewParam, staffEmail: string): Promise<ResearchFile> {
  const file = await readLive<ResearchFile>(`/v1/features/research/engines?basis=${basis}&view=${view}`, staffEmail);
  if (!Array.isArray(file.studies) || !Array.isArray(file.engines)) throw new Error("[research] live file: invalid shape (studies or engines missing)");
  return file;
}

/** The live catalogue (script, template and LLM pages per measure) on one cost basis. */
export async function readLiveCatalog(basis: ResearchBasisParam, view: ResearchViewParam, staffEmail: string): Promise<ResearchCatalog> {
  const catalog = await readLive<ResearchCatalog>(`/v1/features/research/engines/catalog?basis=${basis}&view=${view}`, staffEmail);
  if (!Array.isArray(catalog.engines)) throw new Error("[research] live catalogue: invalid shape (engines missing)");
  return catalog;
}

/** The live template texts, the same on both bases. */
export async function readLiveTemplateTexts(staffEmail: string): Promise<Record<string, string>> {
  return readLive<Record<string, string>>("/v1/features/research/templates", staffEmail);
}

/** The live Performance tab (every script x template x LLM per measure, with the measure's totals and series) on one cost basis. */
export async function readLivePerformance(basis: ResearchBasisParam, view: ResearchViewParam, staffEmail: string): Promise<ResearchPerformance> {
  const perf = await readLive<ResearchPerformance>(`/v1/features/research/engines/performance?basis=${basis}&view=${view}`, staffEmail);
  if (!Array.isArray(perf.engines)) throw new Error("[research] live performance: invalid shape (engines missing)");
  return perf;
}
