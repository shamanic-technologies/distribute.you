/**
 * Research is served LIVE by features-service (LIVE-RESEARCH-1018, owner 2026-10-18: « on ne
 * pourrait pas avoir les articles de recherche lire les data live? »). features-service ports the
 * studies family by family: a study it does not serve yet is listed in its `unavailable` with the
 * reason, and until then the page shows that study from the last nightly snapshot, MARKED as such
 * (`source: "snapshot"`, with the snapshot's read day), never blended into a live figure.
 *
 * The snapshot also still carries the page-wide counts the live file does not serve yet (`volume`,
 * `catalogCounts`, the maturation email counts): kept from it, under its own "read on" day.
 *
 * Alias-free on purpose (no `@/` import): unit-tested directly.
 */
import type { ResearchFile, ResearchStudy } from "./research";

/** What features-service serves at its live Research read: the file minus the snapshot-only counts. */
export type LiveResearchFile = Omit<ResearchFile, "volume" | "catalogCounts" | "maturation"> & {
  /** Null before features-service's first build (the page then shows the snapshot alone). */
  computedAt: string | null;
  maturation: Omit<ResearchFile["maturation"], "excludedEmails" | "noRunStart">;
  unavailable: { id: string; reason: string }[];
};

export type MergedResearchStudy = ResearchStudy & {
  source: "live" | "snapshot";
  /** Snapshot studies only: why the live read does not serve it yet. */
  liveReason?: string;
};

export type MergedResearchFile = Omit<ResearchFile, "studies"> & {
  /** When features-service last built the live studies; null before its first build. */
  computedAt: string | null;
  studies: MergedResearchStudy[];
};

/** PURE. Live studies win; a study the live read does not serve comes from the snapshot, marked. */
export function mergeLiveResearch(live: LiveResearchFile, snapshot: ResearchFile): MergedResearchFile {
  const liveById = new Map(live.studies.map((s) => [s.id, s]));
  const reasonById = new Map(live.unavailable.map((u) => [u.id, u.reason]));
  const studies: MergedResearchStudy[] = [];
  const seen = new Set<string>();
  // The snapshot's order is the page's order; a study only the live read knows goes after.
  for (const s of snapshot.studies) {
    seen.add(s.id);
    const l = liveById.get(s.id);
    if (l) studies.push({ ...l, source: "live" });
    else studies.push({ ...s, source: "snapshot", liveReason: reasonById.get(s.id) });
  }
  for (const l of live.studies) if (!seen.has(l.id)) studies.push({ ...l, source: "live" });
  return {
    ...snapshot,
    ...live,
    volume: snapshot.volume,
    catalogCounts: snapshot.catalogCounts,
    maturation: { ...live.maturation, excludedEmails: snapshot.maturation.excludedEmails, noRunStart: snapshot.maturation.noRunStart },
    // The day the snapshot-only counts (and every snapshot study) were read.
    readOn: snapshot.readOn,
    studies,
  };
}
