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
