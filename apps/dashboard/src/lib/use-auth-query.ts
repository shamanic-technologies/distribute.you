import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

/**
 * React Query hook for authenticated API calls.
 * Auth is handled by the /api/v1 proxy (Clerk session cookies),
 * so no token passing is needed.
 *
 * Org-consistency gate: during an org switch the URL still points at the previous
 * org while Clerk's active org has already rotated (or vice-versa, e.g. a cross-tab
 * switch leaves the URL stale until navigation catches up). Suspend org-owned reads
 * until the two agree, so we never fire a cross-org request (→ proxy 409 / 404).
 * When the page isn't org-scoped (no `/orgs/<id>` in the path) there is nothing to
 * gate. The cache itself is reset atomically on switch by the keyed QueryProvider
 * remount (see lib/query-provider.tsx); this gate just avoids in-flight cross-org
 * requests during the brief settle window.
 */
export function useAuthQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">
) {
  const { organization } = useOrganization();
  const pathname = usePathname();

  const urlOrgId = pathname?.match(/\/orgs\/([^/]+)/)?.[1] ?? null;
  const activeOrgId = organization?.id ?? null;
  // Gate org-owned reads on URL-org === active-org. Critically we must NOT fire
  // while the active org is still unresolved (Clerk session loading / rotating):
  // a request fired then runs under an UNKNOWN org and its response lands under a
  // null-org-keyed cache/persister bucket shared across orgs — the "null tenant
  // window" cross-org bleed (TanStack discussion #3743, DIS-143). So on an
  // org-scoped page we require a resolved active org that matches the URL; the
  // earlier escape that let reads fire under no active org has been removed.
  // Non-org pages (no /orgs/<id> in the path) have nothing to gate.
  const orgConsistent = !urlOrgId || urlOrgId === activeOrgId;

  return useQuery<T, Error>({
    queryKey,
    queryFn,
    ...options,
    // Honor the caller's `enabled` (treat only an explicit `false` as off) AND the
    // org-consistency gate. Computed last so it overrides the spread.
    enabled: options?.enabled !== false && orgConsistent,
  });
}

export { useQueryClient };
