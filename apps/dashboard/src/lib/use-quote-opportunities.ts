import { useMutation } from "@tanstack/react-query";
import {
  generateExpertQuotePitch,
  submitQuoteOpportunityReply,
  type GenerateExpertQuotePitchArgs,
  type GenerateQuoteDraftResponse,
  type SubmitQuotePitchBody,
  type SubmitQuotePitchResponse,
} from "./api";
import { useQueryClient } from "./use-auth-query";

export function useGenerateQuoteDraft() {
  return useMutation<
    GenerateQuoteDraftResponse,
    Error,
    GenerateExpertQuotePitchArgs
  >({
    mutationKey: ["generateQuoteDraft"],
    mutationFn: (args) => generateExpertQuotePitch(args),
  });
}

export function useSubmitQuotePitch(brandId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    SubmitQuotePitchResponse,
    Error,
    { opportunityId: string; body: SubmitQuotePitchBody }
  >({
    mutationKey: ["submitQuotePitch"],
    mutationFn: ({ opportunityId, body }) =>
      submitQuoteOpportunityReply(opportunityId, body, brandId),
    onSuccess: () => {
      // Prefix-only keys: the pitch pages key on ["quotePitches", {campaignId,
      // status}] and ["featureQuotePitches", featureSlug, {status}], and the
      // opportunity queues on ["rankedOpportunities", {brandId}]. A second key
      // element that doesn't deep-contain {brandId} won't match — so invalidate
      // by prefix to refresh every variant (queue drops the now-pitched row,
      // pitches page shows the new submission).
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rankedOpportunities"] }),
        queryClient.invalidateQueries({ queryKey: ["quotePitches"] }),
        queryClient.invalidateQueries({ queryKey: ["featureQuotePitches"] }),
        queryClient.invalidateQueries({ queryKey: ["featureStats"] }),
      ]);
    },
  });
}
