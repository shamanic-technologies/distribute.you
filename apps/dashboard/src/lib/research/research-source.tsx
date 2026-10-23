"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
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
 */
export type ResearchBasis = "user" | "actual";

async function fetchPart<T>(basis: ResearchBasis, part: "file" | "catalog" | "texts" | "performance"): Promise<T> {
  const res = await fetch(`/api/research/${basis}/${part}`, { cache: "no-store" });
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
  return useQuery({
    queryKey: basis === "actual" ? ["researchCatalogActual"] : ["researchCatalog", basis],
    queryFn: () => fetchPart<ResearchCatalog>(basis, "catalog"),
    retry: false,
  });
}

/** The Research file (studies, pipes) on one basis: painted from disk on the billed basis, then re-read. */
function researchFileQuery(basis: ResearchBasis) {
  return {
    queryKey: basis === "actual" ? ["researchFileActual"] : ["researchFile", basis],
    queryFn: () => fetchPart<ResearchFile>(basis, "file"),
    retry: false,
  } as const;
}

function researchPerformanceQuery(basis: ResearchBasis) {
  return {
    queryKey: basis === "actual" ? ["researchPerformanceActual"] : ["researchPerformance", basis],
    queryFn: () => fetchPart<ResearchPerformance>(basis, "performance"),
    retry: false,
  } as const;
}

const TEXTS_QUERY = { queryKey: ["researchTexts"], queryFn: () => fetchPart<Record<string, string>>("user", "texts"), ...ONCE } as const;

/** The Performance tab's read on one basis (disk on the billed basis; the actual basis reveals our margin, memory only). */
export function useResearchPerformance(basis: ResearchBasis) {
  return useQuery(researchPerformanceQuery(basis));
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
  const q = useQuery(researchFileQuery("user"));
  return q.data?.pipes ?? null;
}

export interface ResearchSource {
  basis: ResearchBasis;
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
  const q = useQuery(researchFileQuery(basis));
  useResearchCatalog(basis);
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.prefetchQuery(researchPerformanceQuery(basis));
    void queryClient.prefetchQuery(TEXTS_QUERY);
  }, [queryClient, basis]);
  if (q.isError) return <>{failed}</>;
  if (!q.data) return <>{pending}</>;
  return <Ctx.Provider value={{ basis, file: q.data }}>{children}</Ctx.Provider>;
}
