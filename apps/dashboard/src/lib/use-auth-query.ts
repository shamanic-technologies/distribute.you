import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useOrganization } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useRef } from "react";

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

  // MONOTONIC null-blink latch. Clerk's `useOrganization()` blinks `organization:
  // null` transiently during background JWT rotation (~1/min) and on tab
  // focus/reconnect (CLAUDE.md "Readiness gates MUST be monotonic"). A raw
  // `urlOrgId === activeOrgId` gate then flips to FALSE on every blink → the query
  // goes `enabled:false` → a v5 disabled query reports `isPending:true` → any
  // skeleton gated on `isPending` (e.g. the leads page) re-shows and, if the
  // IndexedDB cache was evicted, STAYS forever (the infinite-skeleton report). Latch
  // the last RESOLVED (non-null) active org and compare against that when the live
  // value is a transient null, so a blink can't re-disable an already-consistent
  // query. We ONLY fill a null — a genuinely DIFFERENT non-null active org (real
  // switch / cross-tab) still closes the gate, preserving DIS-143 cross-org
  // isolation (never fire a URL-org read under another org's token → proxy 409).
  const lastResolvedActiveOrgId = useRef<string | null>(null);
  if (activeOrgId) lastResolvedActiveOrgId.current = activeOrgId;
  const effectiveActiveOrgId = activeOrgId ?? lastResolvedActiveOrgId.current;

  // Gate org-owned reads on URL-org === active-org. Critically we must NOT fire
  // while the active org is still unresolved (Clerk session loading / rotating):
  // a request fired then runs under an UNKNOWN org and its response lands under a
  // null-org-keyed cache/persister bucket shared across orgs — the "null tenant
  // window" cross-org bleed (TanStack discussion #3743, DIS-143). So on an
  // org-scoped page we require a resolved active org that matches the URL; the
  // earlier escape that let reads fire under no active org has been removed.
  // Non-org pages (no /orgs/<id> in the path) have nothing to gate.
  const orgConsistent = !urlOrgId || urlOrgId === effectiveActiveOrgId;

  return useQuery<T, Error>({
    queryKey,
    queryFn,
    ...options,
    // Honor the caller's `enabled` (treat only an explicit `false` as off) AND the
    // org-consistency gate. Computed last so it overrides the spread.
    enabled: options?.enabled !== false && orgConsistent,
  });
}

/**
 * The same org-consistency gate, for a caller that cannot use `useAuthQuery`.
 *
 * `useQueries` is the one legitimate reason: a surface fanning out over a set whose
 * SIZE is decided at render (one read per acquisition channel an offer sells
 * through) cannot call a hook per member without breaking the rules of hooks. Such a
 * caller still must not fire a cross-org read, so it asks for the verdict here
 * rather than re-deriving it — a second copy of this gate is how one surface keeps
 * the DIS-143 isolation and another quietly loses it.
 *
 * Returns false while the active org is unresolved or disagrees with the URL. AND it
 * into every `enabled` in the fan-out.
 */
export function useOrgQueryGate(): boolean {
  const { organization } = useOrganization();
  const pathname = usePathname();

  const urlOrgId = pathname?.match(/\/orgs\/([^/]+)/)?.[1] ?? null;
  const activeOrgId = organization?.id ?? null;

  // Same monotonic null-blink latch as above, and for the same reason: a transient
  // `organization: null` during JWT rotation must not re-disable a settled read.
  const lastResolvedActiveOrgId = useRef<string | null>(null);
  if (activeOrgId) lastResolvedActiveOrgId.current = activeOrgId;
  const effectiveActiveOrgId = activeOrgId ?? lastResolvedActiveOrgId.current;

  return !urlOrgId || urlOrgId === effectiveActiveOrgId;
}

export { useQueryClient };
