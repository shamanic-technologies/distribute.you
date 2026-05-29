import { useMutation } from "@tanstack/react-query";
import {
  getPromptAssignment,
  savePromptAssignment,
  type PromptAssignment,
  type SavePromptAssignmentBody,
} from "./api";
import { useAuthQuery, useQueryClient } from "./use-auth-query";

const promptAssignmentKey = (featureSlug: string) =>
  ["promptAssignment", { featureSlug }] as const;

/** Reads the resolved generation prompt for a feature. */
export function usePromptAssignment(featureSlug: string, enabled = true) {
  return useAuthQuery<PromptAssignment>(
    promptAssignmentKey(featureSlug),
    () => getPromptAssignment(featureSlug),
    { enabled },
  );
}

/** Saves an edited prompt (forks + reassigns) and writes the fork to cache. */
export function useSavePromptAssignment(featureSlug: string) {
  const queryClient = useQueryClient();
  return useMutation<PromptAssignment, Error, SavePromptAssignmentBody>({
    mutationKey: ["savePromptAssignment", featureSlug],
    mutationFn: (body) => savePromptAssignment(body),
    onSuccess: (data) => {
      // Mutation returns the fresh resolved assignment — write it directly so
      // the panel reflects the new fork without depending on a refetch.
      queryClient.setQueryData(promptAssignmentKey(featureSlug), data);
    },
  });
}
