"use client";

import { useMemo } from "react";
import { useResearchCatalog } from "@/lib/research/research-source";
import { PIPE_ORDER, researchTemplateOf, type ResearchCatalog } from "@/lib/research/research";

/** A served mark (MARKS-1022): a Phosphor name and `#RRGGBB`. */
export interface ServedMark {
  icon: string | null;
  color: string | null;
}

const NONE: ServedMark = { icon: null, color: null };

/**
 * The marks features-service serves per workflow dynasty and per template dynasty, read off the
 * Research catalogue (`/internal/research/catalog`, staff-only route; a reader without access gets
 * none and the kind's glyph stays). Keyed on the dynasty slug; a template VERSION key resolves to its
 * dynasty (`researchTemplateOf`). Never a mark the producer did not serve.
 */
export function servedMarks(catalog: ResearchCatalog | null | undefined) {
  const workflow = (slug: string | null | undefined): ServedMark => {
    if (!catalog || !slug) return NONE;
    for (const p of PIPE_ORDER) {
      const w = catalog[p]?.workflows.find((x) => x.key === slug);
      if (w?.icon) return { icon: w.icon, color: w.color ?? null };
    }
    return NONE;
  };
  const template = (key: string | null | undefined): ServedMark => {
    if (!catalog || !key) return NONE;
    for (const p of PIPE_ORDER) {
      if (!catalog[p]) continue;
      const t = researchTemplateOf(catalog, p, key);
      if (t?.icon) return { icon: t.icon, color: t.color ?? null };
    }
    return NONE;
  };
  return { workflow, template };
}

/** `servedMarks` over the shared Research catalogue cache. */
export function useServedMarks() {
  const { data } = useResearchCatalog("user");
  return useMemo(() => servedMarks(data), [data]);
}
