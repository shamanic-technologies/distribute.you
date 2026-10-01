"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import type { ResearchCatalog, ResearchFile } from "@/lib/research/research";

/**
 * Where Research's data comes from: the staff-only `/api/research/{basis}/{part}` route, never a
 * bundled file, so a customer who opens the dev tools finds no figure (the route answers 403 off
 * the staff list). `basis` is `user` (billed) or, for a staff reader on the Actual cost basis,
 * `actual` (what the vendors charged us). Every Research component reads through `useResearch()`,
 * so one switch in the top bar moves the hub, every study and every workflow, template and LLM page.
 *
 * None of these roots is persisted to disk (`research*` is not a persisted root).
 */
export type ResearchBasis = "user" | "actual";

async function fetchPart<T>(basis: ResearchBasis, part: "file" | "catalog" | "texts"): Promise<T> {
  const res = await fetch(`/api/research/${basis}/${part}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`[research] ${basis}/${part} answered ${res.status}`);
  return (await res.json()) as T;
}

const ONCE = { staleTime: Infinity, retry: false } as const;

/** The catalogue (workflow, template and model pages) on one basis. Shared by the chips on a workflow page. */
export function useResearchCatalog(basis: ResearchBasis) {
  return useQuery({ queryKey: ["researchCatalog", basis], queryFn: () => fetchPart<ResearchCatalog>(basis, "catalog"), ...ONCE });
}

/** The template texts, the same on both bases. */
export function useResearchTexts(enabled: boolean) {
  return useQuery({ queryKey: ["researchTexts"], queryFn: () => fetchPart<Record<string, string>>("user", "texts"), enabled, ...ONCE });
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

/**
 * Renders `children` once the snapshot on the reader's basis has loaded; `pending` until then and
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
