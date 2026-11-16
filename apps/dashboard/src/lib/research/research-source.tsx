"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { pollOptions } from "@/lib/query-options";
import { useMaturityView } from "@/lib/v2/use-maturity-view";
import type { MaturityView } from "@/lib/v2/maturity-view-cookie";
import { researchMeasureEntry, type ResearchCatalog, type ResearchFile, type ResearchMeasure, type ResearchMeasureEntry } from "@/lib/research/research";
import type { ResearchPerformance } from "@/lib/research/performance";
import { parseLiveScripts } from "@/lib/research/live-scripts";

/**
 * Where Research's data comes from: the staff-only `/api/research/{basis}/{part}` route, never a
 * bundled file, so a customer who opens the dev tools finds no figure (the route answers 403 off
 * the staff list). `basis` is `user` (billed) or, for a staff reader on the Actual cost basis,
 * `actual` (what the vendors charged us). Every Research component reads through `useResearch()`,
 * so one switch in the top bar moves the hub, every study and every script, template and LLM page.
 *
 * The billed-basis file, catalogue, Performance tab and live script rankings are persisted to disk
 * (`researchEngineFile`, `researchEngineCatalog`, `researchEnginePerformance`, `researchLiveScripts`, staff
 * browsers only; renamed from the pipe-keyed roots by RESEARCH-BY-ENGINE-1113, so no pipe-era copy paints):
 * every Research page paints on the first frame, then re-reads (owner 2026-10-21 « It should be instant »,
 * 2026-10-23 « instantanées »). The actual-basis reads (our margin) sit under their own roots
 * (`researchEngineFileActual`, `researchEngineCatalogActual`, `researchEnginePerformanceActual`), never
 * written to disk; the texts stay memory-only.
 *
 * Every read but the texts also carries the staff Mature / Flash view (`view=`, MATURITY-VIEW-1023)
 * and every query key ends on it, so one view's body is never painted under the other's switch.
 */
export type ResearchBasis = "user" | "actual";

async function fetchPart<T>(basis: ResearchBasis, part: "file" | "catalog" | "texts" | "performance" | "live-scripts", view?: MaturityView, measure?: string): Promise<T> {
  const query = new URLSearchParams();
  if (view) query.set("view", view);
  if (measure) query.set("measure", measure);
  const qs = query.toString();
  const res = await fetch(`/api/research/${basis}/${part}${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`[research] ${basis}/${part} answered ${res.status}`);
  return (await res.json()) as T;
}

const ONCE = { staleTime: Infinity, retry: false } as const;

/**
 * The catalogue (script, template and LLM pages) on one basis. Shared by the chips on a workflow page.
 * Painted from disk, then re-read once the default staleTime has passed (never `Infinity`: a restored
 * copy would otherwise be served for 30 days).
 */
export function useResearchCatalog(basis: ResearchBasis) {
  const { view } = useMaturityView();
  return useQuery({
    queryKey: basis === "actual" ? ["researchEngineCatalogActual", view] : ["researchEngineCatalog", basis, view],
    queryFn: () => fetchPart<ResearchCatalog>(basis, "catalog", view),
    retry: false,
  });
}

/** The Research file (studies, Engines and their measures) on one basis: painted from disk on the billed basis, then re-read. */
function researchFileQuery(basis: ResearchBasis, view: MaturityView) {
  return {
    queryKey: basis === "actual" ? ["researchEngineFileActual", view] : ["researchEngineFile", basis, view],
    queryFn: () => fetchPart<ResearchFile>(basis, "file", view),
    retry: false,
  } as const;
}

function researchPerformanceQuery(basis: ResearchBasis, view: MaturityView) {
  return {
    queryKey: basis === "actual" ? ["researchEnginePerformanceActual", view] : ["researchEnginePerformance", basis, view],
    queryFn: () => fetchPart<ResearchPerformance>(basis, "performance", view),
    retry: false,
  } as const;
}

const TEXTS_QUERY = { queryKey: ["researchTexts"], queryFn: () => fetchPart<Record<string, string>>("user", "texts"), ...ONCE } as const;

/** The Performance tab's read on one basis (disk on the billed basis; the actual basis reveals our margin, memory only). */
export function useResearchPerformance(basis: ResearchBasis) {
  return useQuery(researchPerformanceQuery(basis, useMaturityView().view));
}

/** The template texts, the same on both bases. */
export function useResearchTexts(enabled: boolean) {
  return useQuery({ ...TEXTS_QUERY, enabled });
}

/**
 * One measure's scripts as the fleet ranks them right now (net pricing; the same body on both bases and
 * views), polled like every v2 read. Disabled (never sent) without a measure.
 */
export function useLiveScripts(measure: ResearchMeasure | null) {
  return useQuery({
    queryKey: ["researchLiveScripts", measure ?? ""],
    queryFn: async () => parseLiveScripts(await fetchPart<unknown>("user", "live-scripts", undefined, measure ?? "")),
    ...pollOptions,
    retry: false,
    enabled: measure != null,
  });
}

export interface ResearchSource {
  basis: ResearchBasis;
  view: MaturityView;
  file: ResearchFile;
}

const Ctx = createContext<ResearchSource | null>(null);

export function useResearch(): ResearchSource {
  const v = useContext(Ctx);
  if (!v) throw new Error("[research] useResearch() outside ResearchSourceProvider");
  return v;
}

const missingMeasures = new Set<string>();
/**
 * A measure's served entry (Engine, from, counts) off the file. The page renders a measure only once
 * the file lists it, so a null here is a producer withdrawal mid-session: logged once, never a crash.
 */
export function useResearchMeasureEntry(measure: ResearchMeasure | null): ResearchMeasureEntry | null {
  const entry = researchMeasureEntry(useResearch().file, measure);
  if (measure && !entry && !missingMeasures.has(measure)) {
    missingMeasures.add(measure);
    console.error("[research] measure not in the served file", { measure });
  }
  return entry;
}

/**
 * Renders `children` once the live file on the reader's basis has loaded; `pending` until then and
 * `failed` when the route refused or broke, never one basis's figures under the other's label.
 * The catalogue starts loading at once beside it, and the Performance tab and template texts right
 * after, so a click on a script, a template or Performance finds its data already there.
 */
export function ResearchSourceProvider({
  children,
  pending,
  failed,
}: {
  children: React.ReactNode;
  pending: React.ReactNode;
  failed: React.ReactNode;
}) {
  const { actual } = useCostBasis();
  const basis: ResearchBasis = actual ? "actual" : "user";
  const { view } = useMaturityView();
  const q = useQuery(researchFileQuery(basis, view));
  useResearchCatalog(basis);
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery(researchPerformanceQuery(basis, view));
    void queryClient.prefetchQuery(TEXTS_QUERY);
  }, [queryClient, basis, view]);
  if (q.isError) return <>{failed}</>;
  if (!q.data) return <>{pending}</>;
  return <Ctx.Provider value={{ basis, view, file: q.data }}>{children}</Ctx.Provider>;
}
