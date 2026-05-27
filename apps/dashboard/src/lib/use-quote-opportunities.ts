import { useMutation } from "@tanstack/react-query";
import {
  generateQuoteDraft,
  submitQuoteOpportunityReply,
  type GenerateQuoteDraftBody,
  type GenerateQuoteDraftResponse,
  type SubmitQuotePitchBody,
  type SubmitQuotePitchResponse,
} from "./api";
import { useQueryClient } from "./use-auth-query";

export function useGenerateQuoteDraft() {
  return useMutation<
    GenerateQuoteDraftResponse,
    Error,
    { quoteRequestId: string; body: GenerateQuoteDraftBody }
  >({
    mutationKey: ["generateQuoteDraft"],
    mutationFn: ({ quoteRequestId, body }) =>
      generateQuoteDraft(quoteRequestId, body),
  });
}

export function useSubmitQuotePitch(campaignId: string, brandId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    SubmitQuotePitchResponse,
    Error,
    { opportunityId: string; body: SubmitQuotePitchBody }
  >({
    mutationKey: ["submitQuotePitch"],
    mutationFn: ({ opportunityId, body }) =>
      submitQuoteOpportunityReply(opportunityId, body),
    onSuccess: () => {
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["rankedOpportunities", { campaignId, brandId }],
        }),
        queryClient.invalidateQueries({
          queryKey: ["quotePitches", { brandId, campaignId }],
        }),
        queryClient.invalidateQueries({
          queryKey: ["featureStats"],
        }),
      ]);
    },
  });
}
