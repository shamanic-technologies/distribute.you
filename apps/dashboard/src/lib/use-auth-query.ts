import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";

/**
 * React Query hook for authenticated API calls.
 * Auth is handled by the /api/v1 proxy (Clerk session cookies),
 * so no token passing is needed.
 */
export function useAuthQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">
) {
  return useQuery<T, Error>({
    queryKey,
    queryFn,
    ...options,
  });
}

export { useQueryClient };
