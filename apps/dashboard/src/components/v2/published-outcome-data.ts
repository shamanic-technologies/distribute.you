"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getBrandPublishedUnits } from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { outcomeOf } from "@/lib/v2/outcomes";
import { PUBLISHED_OUTCOME_KEYS, type PublishedOutcomeKey } from "@/lib/v2/published-units";

/**
 * The published outcomes' READS, apart from their page (`published-outcome-page.tsx`): the v2 sidebar
 * lists them on every page, so the shell imports this module and never the page body and its charts
 * (MON-PAGE-SPEED-FLOOR-1120: the shell's JavaScript is every v2 page's floor).
 */

export function usePublishedUnits(brandId: string, outcomeKey: PublishedOutcomeKey) {
  return useAuthQuery(["publishedUnits", brandId, outcomeKey], () => getBrandPublishedUnits(brandId, outcomeKey), { ...pollOptions, enabled: !!brandId });
}

/** Every published outcome's read, in a fixed order (the Outcomes overview lists one card per outcome with a row). */
export function usePublishedOutcomes(brandId: string) {
  const newsletter = usePublishedUnits(brandId, "newsletter_email_sent");
  const x = usePublishedUnits(brandId, "x_post_published");
  const linkedin = usePublishedUnits(brandId, "linkedin_post_published");
  const threads = usePublishedUnits(brandId, "threads_post_published");
  const byKey = { newsletter_email_sent: newsletter, x_post_published: x, linkedin_post_published: linkedin, threads_post_published: threads };
  const reads = PUBLISHED_OUTCOME_KEYS.map((key) => ({ key, q: byKey[key] }));
  return {
    settled: reads.every((r) => r.q.data !== undefined || r.q.isError),
    failed: reads.filter((r) => !r.q.data && r.q.isError).map((r) => r.key),
    withRows: reads.flatMap((r) => (r.q.data && r.q.data.rows.length > 0 ? [{ key: r.key, data: r.q.data }] : [])),
  };
}

/** A published outcome's served catalogue name (the sidebar entry and the page title read the same one). */
export function usePublishedOutcomeLabel(key: PublishedOutcomeKey): string {
  const catalogue = useLegCatalogue();
  return outcomeOf(catalogue, null, key)?.label ?? key;
}
