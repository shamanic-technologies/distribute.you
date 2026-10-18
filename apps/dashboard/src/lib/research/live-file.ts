import billedFile from "@/lib/research/research.json";
import actualFile from "@/lib/research/actual/research.json";
import type { ResearchFile } from "@/lib/research/research";
import { mergeLiveResearch, type LiveResearchFile, type MergedResearchFile } from "@/lib/research/live-merge";

/**
 * SERVER ONLY. The Research file the page renders: features-service's LIVE studies (gateway
 * `GET /v1/features/research`, staff only: admin key + a staff `x-email`), each study it does not
 * serve yet taken from the nightly snapshot and marked (`lib/research/live-merge.ts`).
 *
 * Before features-service's first build it answers 503 `research_not_computed_yet`: the page then
 * shows the snapshot alone, every study marked snapshot (a stated state, not a silent default).
 * Any other failure throws: the route answers it and the page shows its error.
 */
const API_URL = (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you").replace(/\/$/, "");

export type ResearchBasisParam = "user" | "actual";

const SNAPSHOTS: Record<ResearchBasisParam, ResearchFile> = {
  user: billedFile as unknown as ResearchFile,
  actual: actualFile as unknown as ResearchFile,
};

export async function readMergedResearch(basis: ResearchBasisParam, staffEmail: string): Promise<MergedResearchFile> {
  const key = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (!key) throw new Error("[research] ADMIN_DISTRIBUTE_API_KEY is not set");
  const snapshot = SNAPSHOTS[basis];
  const res = await fetch(`${API_URL}/v1/features/research?basis=${basis}`, {
    headers: { "X-API-Key": key, "x-email": staffEmail },
    cache: "no-store",
  });
  if (res.status === 503) {
    const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (body?.error === "research_not_computed_yet" || body?.code === "research_not_computed_yet") {
      console.warn("[research] live studies not built yet: serving the snapshot, every study marked");
      return mergeLiveResearch(
        { ...snapshot, computedAt: null, studies: [], unavailable: [] } as unknown as LiveResearchFile,
        snapshot,
      );
    }
    throw new Error(`[research] live read answered 503: ${JSON.stringify(body)}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[research] live read answered ${res.status}: ${text.slice(0, 300)}`);
  }
  const live = (await res.json()) as LiveResearchFile;
  if (!Array.isArray(live.studies) || !Array.isArray(live.unavailable)) {
    throw new Error("[research] live read: invalid shape (studies/unavailable missing)");
  }
  return mergeLiveResearch(live, snapshot);
}
