import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getVisibilityRun,
  listVisibilityRuns,
  type ListVisibilityRunsParams,
  type VisibilityRunDetail,
} from "@/lib/api";

/**
 * Resolve the most recent visibility run for a scope, then fetch its full detail.
 *
 * Scope is brand-only at the feature level (union across the brand's campaigns)
 * or brand+campaign at the campaign level — `campaignId` is optional on the
 * api-service `/orgs/visibility-score-runs` filter, so dropping it widens the
 * query to every campaign of the brand. Shared by the prompts + competitors
 * views so both levels render identically off one query path.
 */
export function useLatestVisibilityRunDetail(scope: ListVisibilityRunsParams): {
  latestRunId: string | undefined;
  detail: VisibilityRunDetail | undefined;
  isLoading: boolean;
} {
  const { data: runsList, isLoading: runsLoading } = useAuthQuery(
    ["visibilityRuns", { ...scope, latestOnly: true }],
    () => listVisibilityRuns({ ...scope, limit: 1 }),
    { placeholderData: keepPreviousData },
  );

  const latestRunId = runsList?.runs[0]?.id;

  const { data: detail, isLoading: detailLoading } = useAuthQuery(
    ["visibilityRun", latestRunId],
    () => getVisibilityRun(latestRunId as string),
    { enabled: !!latestRunId },
  );

  return {
    latestRunId,
    detail,
    isLoading: runsLoading || (!!latestRunId && detailLoading),
  };
}
