"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
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
 * Only the billed-basis catalogue is persisted to disk (`researchCatalog`, staff browsers only): the
 * Workflows table's LLM and Template cells paint on the first frame instead of waiting for 825KB
 * (owner 2026-10-21, « It should be instant »). The actual-basis catalogue (our margin) sits under its
 * own root, `researchCatalogActual`, never written to disk; the file and texts stay memory-only.
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

/** The Performance tab's read on one basis (memory only: the actual basis reveals our margin). */
export function useResearchPerformance(basis: ResearchBasis) {
  return useQuery({ queryKey: ["researchPerformance", basis], queryFn: () => fetchPart<ResearchPerformance>(basis, "performance"), retry: false });
}

/** The template texts, the same on both bases. */
export function useResearchTexts(enabled: boolean) {
  return useQuery({ queryKey: ["researchTexts"], queryFn: () => fetchPart<Record<string, string>>("user", "texts"), enabled, ...ONCE });
}

/**
 * The pipes the billed-basis Research file serves, for a staff surface outside the Research page (a
 * workflow page's chips): the same query the page holds, so it is read once. Null until it answers
 * (a non-staff reader gets a 403 and never a pipe).
 */
export function useResearchPipes(): ResearchPipeEntry[] | null {
  const q = useQuery({ queryKey: ["researchFile", "user"], queryFn: () => fetchPart<ResearchFile>("user", "file"), ...ONCE });
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
 * The catalogue starts loading at once beside it, so a click on a workflow finds it in memory.
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
  const q = useQuery({ queryKey: ["researchFile", basis], queryFn: () => fetchPart<ResearchFile>(basis, "file"), ...ONCE });
  useResearchCatalog(basis);
  if (q.isError) return <>{failed}</>;
  if (!q.data) return <>{pending}</>;
  return <Ctx.Provider value={{ basis, file: q.data }}>{children}</Ctx.Provider>;
}
