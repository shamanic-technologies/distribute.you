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
    { body: GenerateQuoteDraftBody }
  >({
    mutationKey: ["generateQuoteDraft"],
    mutationFn: ({ body }) => generateQuoteDraft(body),
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
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["rankedOpportunities", { brandId }],
        }),
        queryClient.invalidateQueries({
          queryKey: ["quotePitches", { brandId }],
        }),
        queryClient.invalidateQueries({
          queryKey: ["featureStats"],
        }),
      ]);
    },
  });
}
