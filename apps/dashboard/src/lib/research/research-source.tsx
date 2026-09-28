"use client";

import { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import {
  RESEARCH,
  loadResearchCatalog,
  peekResearchCatalog,
  type ResearchCatalog,
  type ResearchFile,
} from "@/lib/research/research";

/**
 * Which Research snapshot the page reads: the billed one (bundled, everyone) or, for a staff
 * reader on the Actual cost basis, the vendor-cost one served by the staff-only
 * `/api/research/actual` route. Every Research component reads through `useResearch()`, so one
 * switch in the top bar moves the hub, every study and every workflow, template and LLM page.
 */
export interface ResearchSource {
  basis: "user" | "actual";
  file: ResearchFile;
  peekCatalog: () => ResearchCatalog | null;
  loadCatalog: () => Promise<ResearchCatalog>;
}

const USER_SOURCE: ResearchSource = {
  basis: "user",
  file: RESEARCH,
  peekCatalog: peekResearchCatalog,
  loadCatalog: loadResearchCatalog,
};

const Ctx = createContext<ResearchSource>(USER_SOURCE);

export function useResearch(): ResearchSource {
  return useContext(Ctx);
}

async function fetchActual(): Promise<{ file: ResearchFile; catalog: ResearchCatalog }> {
  const res = await fetch("/api/research/actual", { cache: "no-store" });
  if (!res.ok) throw new Error(`[research] actual-cost snapshot answered ${res.status}`);
  return (await res.json()) as { file: ResearchFile; catalog: ResearchCatalog };
}

/**
 * Renders `children` on the billed snapshot, or on the actual one once it has loaded. While the
 * actual one is loading it renders `pending`, never the billed figures under the actual label.
 * The actual snapshot is never persisted to disk (`researchActual` is not a persisted root).
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
  const q = useQuery({ queryKey: ["researchActual"], queryFn: fetchActual, enabled: actual, staleTime: Infinity, retry: false });
  if (!actual) return <Ctx.Provider value={USER_SOURCE}>{children}</Ctx.Provider>;
  if (q.isError) return <>{failed}</>;
  if (!q.data) return <>{pending}</>;
  const { file, catalog } = q.data;
  const source: ResearchSource = {
    basis: "actual",
    file,
    peekCatalog: () => catalog,
    loadCatalog: () => Promise.resolve(catalog),
  };
  return <Ctx.Provider value={source}>{children}</Ctx.Provider>;
}
