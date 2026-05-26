import { useMutation } from "@tanstack/react-query";
import {
  listManualQualifications,
  setManualQualification,
  type ListManualQualificationsResponse,
  type ManualQualification,
  type ManualQualificationStatus,
  type SetManualQualificationResponse,
} from "./api";
import { useAuthQuery, useQueryClient } from "./use-auth-query";
import { POLL_INTERVAL } from "./query-options";

export function manualQualificationsQueryKey(brandId: string) {
  return ["manualQualifications", "brand", brandId] as const;
}

// Single org-wide fetch (caller is org-scoped via Bearer). Brand-level page filters
// client-side by the `(campaignId, email)` pairs of its rendered leads. Limit 500 is
// the upstream cap; rare orgs above that ceiling lose oldest qualifications first
// (qualifiedAt DESC), an accepted V1 trade-off.
export function useManualQualifications(brandId: string) {
  return useAuthQuery<ListManualQualificationsResponse>(
    manualQualificationsQueryKey(brandId),
    () => listManualQualifications({ limit: 500 }),
    { refetchInterval: POLL_INTERVAL },
  );
}

export function useSetManualQualification(brandId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    SetManualQualificationResponse,
    Error,
    { campaignId: string; email: string; status: ManualQualificationStatus }
  >({
    mutationFn: (input) => setManualQualification(input),
    onSuccess: (data) => {
      const key = manualQualificationsQueryKey(brandId);
      // Write the fresh qualification into the list cache directly so the badge
      // flips on the next render without waiting for the poll refetch — same
      // discipline as `use-stop-campaign.ts` (avoids stale-cache bug when the
      // next GET happens to fail).
      queryClient.setQueryData<ListManualQualificationsResponse>(key, (prev) => {
        const existing = prev?.qualifications ?? [];
        const filtered = existing.filter(
          (q: ManualQualification) =>
            !(q.campaignId === data.qualification.campaignId && q.email === data.qualification.email),
        );
        return { qualifications: [data.qualification, ...filtered] };
      });
      // Brand leads list cache picks up counters that may have shifted via the
      // silver-promotion side effect (instantly-service updates
      // `reply_classification` from manual). Same shape, just refresh values.
      queryClient.invalidateQueries({ queryKey: ["brandLeads", brandId] });
    },
  });
}
