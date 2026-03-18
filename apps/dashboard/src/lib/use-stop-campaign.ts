import { useMutation, useMutationState } from "@tanstack/react-query";
import { stopCampaign, sendCampaignEmail, type Campaign } from "./api";
import { useQueryClient } from "./use-auth-query";

const MUTATION_KEY = ["stopCampaign"] as const;

export function useStopCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: MUTATION_KEY,
    mutationFn: (campaign: { id: string } & Partial<Campaign>) =>
      stopCampaign(campaign.id),
    onSuccess: (_data, campaign) => {
      sendCampaignEmail("campaign_stopped", campaign as Campaign).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["campaign", campaign.id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useIsStoppingCampaign(campaignId: string): boolean {
  const pendingMutations = useMutationState({
    filters: { mutationKey: MUTATION_KEY, status: "pending" },
    select: (m) => (m.state.variables as { id: string } | undefined)?.id,
  });
  return pendingMutations.includes(campaignId);
}
