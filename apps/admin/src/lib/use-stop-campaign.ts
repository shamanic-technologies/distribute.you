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
    onSuccess: (data, campaign) => {
      sendCampaignEmail("campaign_stopped", campaign as Campaign).catch(() => {});
      // Write the fresh campaign from the stop response directly to the cache
      // so the UI flips to "stopped" immediately, without depending on the next
      // polling refetch of GET /campaigns/{id} — which may be returning 5xx.
      queryClient.setQueryData(["campaign", campaign.id], data);
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
