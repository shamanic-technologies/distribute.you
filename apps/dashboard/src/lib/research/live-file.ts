import type { ResearchCatalog, ResearchFile } from "@/lib/research/research";
import type { ResearchPerformance } from "@/lib/research/performance";

/**
 * SERVER ONLY. Every byte of Research, read LIVE from features-service through the api-service
 * gateway (staff only: admin key + a staff `x-email`; LIVE-RESEARCH-1018, owner 2026-10-18):
 *
 *   GET /v1/features/research?basis=           the file (studies, rule, pipes, outcomes)
 *   GET /v1/features/research/catalog?basis=   the workflow, template and model pages per pipe
 *   GET /v1/features/research/templates        the template texts, by template id
 *   GET /v1/features/research/performance?basis=   the Performance tab per pipe
 *
 * Every read but the texts also carries `view=mature|flash` (MATURITY-VIEW-1023): which build
 * features-service serves, the staff Mature / Flash switch (`lib/v2/maturity-view-cookie.ts`).
 *
 * No snapshot is kept anywhere: any failure (the 503 `research_not_computed_yet` before
 * features-service's first build included) throws, the route answers it and the page shows its
 * error state, never an older copy.
 */
const API_URL = (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you").replace(/\/$/, "");

export type ResearchBasisParam = "user" | "actual";
export type ResearchViewParam = "mature" | "flash";

async function readLive<T>(path: string, staffEmail: string): Promise<T> {
  const key = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!key) throw new Error("[research] ADMIN_DISTRIBUTE_API_KEY is not set");
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "X-API-Key": key, "x-email": staffEmail },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[research] ${path} answered ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** The live Research file on one cost basis. */
export async function readLiveResearch(basis: ResearchBasisParam, view: ResearchViewParam, staffEmail: string): Promise<ResearchFile> {
  const file = await readLive<ResearchFile>(`/v1/features/research?basis=${basis}&view=${view}`, staffEmail);
  if (!Array.isArray(file.studies)) throw new Error("[research] live file: invalid shape (studies missing)");
  return file;
}

/** The live catalogue (workflow, template and model pages) on one cost basis. */
export async function readLiveCatalog(basis: ResearchBasisParam, view: ResearchViewParam, staffEmail: string): Promise<ResearchCatalog> {
  return readLive<ResearchCatalog>(`/v1/features/research/catalog?basis=${basis}&view=${view}`, staffEmail);
}

/** The live template texts, the same on both bases. */
export async function readLiveTemplateTexts(staffEmail: string): Promise<Record<string, string>> {
  return readLive<Record<string, string>>("/v1/features/research/templates", staffEmail);
}

/** The live Performance tab (every workflow x template x LLM per pipe, with the pipe's totals and series) on one cost basis. */
export async function readLivePerformance(basis: ResearchBasisParam, view: ResearchViewParam, staffEmail: string): Promise<ResearchPerformance> {
  return readLive<ResearchPerformance>(`/v1/features/research/performance?basis=${basis}&view=${view}`, staffEmail);
}
