"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { useMaturityView } from "@/lib/v2/use-maturity-view";
import type { MaturityView } from "@/lib/v2/maturity-view-cookie";
import { researchPipeEntry, type ResearchCatalog, type ResearchFile, type ResearchPipe, type ResearchPipeEntry } from "@/lib/research/research";
import type { ResearchPerformance } from "@/lib/research/performance";

/**
 * Where Research's data comes from: the staff-only `/api/research/{basis}/{part}` route, never a
 * bundled file, so a customer who opens the dev tools finds no figure (the route answers 403 off
 * the staff list). `basis` is `user` (billed) or, for a staff reader on the Actual cost basis,
 * `actual` (what the vendors charged us). Every Research component reads through `useResearch()`,
 * so one switch in the top bar moves the hub, every study and every workflow, template and LLM page.
 *
 * The billed-basis file, catalogue and Performance tab are persisted to disk (`researchFile`,
 * `researchCatalog`, `researchPerformance`, staff browsers only): every Research page paints on the
 * first frame, then re-reads (owner 2026-10-21 « It should be instant », 2026-10-23 « instantanées »).
 * The actual-basis reads (our margin) sit under their own roots (`researchFileActual`,
 * `researchCatalogActual`, `researchPerformanceActual`), never written to disk; the texts stay memory-only.
 *
 * Every read but the texts also carries the staff Mature / Flash view (`view=`, MATURITY-VIEW-1023)
 * and every query key ends on it, so one view's body is never painted under the other's switch.
 */
export type ResearchBasis = "user" | "actual";

async function fetchPart<T>(basis: ResearchBasis, part: "file" | "catalog" | "texts" | "performance", view?: MaturityView): Promise<T> {
  const res = await fetch(`/api/research/${basis}/${part}${view ? `?view=${view}` : ""}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`[research] ${basis}/${part} answered ${res.status}`);
  return (await res.json()) as T;
}

const ONCE = { staleTime: Infinity, retry: false } as const;

/**
 * The catalogue (workflow, template and model pages) on one basis. Shared by the chips on a workflow page.
 * Painted from disk, then re-read once the default staleTime has passed (never `Infinity`: a restored
 * copy would otherwise be served for 30 days).
 */
export function useResearchCatalog(basis: ResearchBasis) {
  const { view } = useMaturityView();
  return useQuery({
    queryKey: basis === "actual" ? ["researchCatalogActual", view] : ["researchCatalog", basis, view],
    queryFn: () => fetchPart<ResearchCatalog>(basis, "catalog", view),
    retry: false,
  });
}

/** The Research file (studies, pipes) on one basis: painted from disk on the billed basis, then re-read. */
function researchFileQuery(basis: ResearchBasis, view: MaturityView) {
  return {
    queryKey: basis === "actual" ? ["researchFileActual", view] : ["researchFile", basis, view],
    queryFn: () => fetchPart<ResearchFile>(basis, "file", view),
    retry: false,
  } as const;
}

function researchPerformanceQuery(basis: ResearchBasis, view: MaturityView) {
  return {
    queryKey: basis === "actual" ? ["researchPerformanceActual", view] : ["researchPerformance", basis, view],
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
 * The pipes the billed-basis Research file serves, for a staff surface outside the Research page (a
 * workflow page's chips): the same query the page holds, so it is read once. Null until it answers
 * (a non-staff reader gets a 403 and never a pipe).
 */
export function useResearchPipes(): ResearchPipeEntry[] | null {
  const q = useQuery(researchFileQuery("user", useMaturityView().view));
  return q.data?.pipes ?? null;
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

const missingPipes = new Set<string>();
/**
 * A pipe's served entry (channel, leg, outcome) off the file. The page renders a pipe only once the
 * file lists it, so a null here is a producer withdrawal mid-session: logged once, never a crash.
 */
export function useResearchPipeEntry(pipe: ResearchPipe | null): ResearchPipeEntry | null {
  const entry = researchPipeEntry(useResearch().file, pipe);
  if (pipe && !entry && !missingPipes.has(pipe)) {
    missingPipes.add(pipe);
    console.error("[research] pipe not in the served file", { pipe });
  }
  return entry;
}

/**
 * A pipe's channel slug. Every pipe view renders only for a pipe the file lists (the page answers
 * Not found otherwise), so the entry is there; the empty string only stands for a pipe withdrawn
 * mid-session, already logged by `useResearchPipeEntry`.
 */
export function usePipeChannel(pipe: ResearchPipe): string {
  return useResearchPipeEntry(pipe)?.channel ?? "";
}

/**
 * Renders `children` once the live file on the reader's basis has loaded; `pending` until then and
 * `failed` when the route refused or broke, never one basis's figures under the other's label.
 * The catalogue starts loading at once beside it, and the Performance tab and template texts right
 * after, so a click on a workflow, a template or Performance finds its data already there.
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
