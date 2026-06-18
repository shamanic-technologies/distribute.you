"use client";

import { useEffect, useRef } from "react";
import { useOrganization } from "@clerk/nextjs";
import { clearBreadcrumbCaches } from "@/components/breadcrumb-nav";

/**
 * Clears the breadcrumb module-level caches when Clerk's active org changes.
 *
 * It DOES NOT navigate. The URL `/orgs/[id]` is the per-tab source of truth for
 * which org a tab is viewing (Clerk: "each tab independently maintains its own
 * Active Organization"). The Clerk active-org signal is the SHARED, global session
 * value — it flips when ANOTHER tab switches org. A previous version navigated this
 * tab to the new active org whenever that signal changed, which meant switching org
 * in tab B yanked tab A's URL onto B's org — the visible "the org switches by itself"
 * bug across tabs. So navigation is now driven ONLY by an explicit in-tab action
 * (the breadcrumb switcher) and by the URL→active aligner (OrgActivator); this
 * component never moves a tab on a cross-tab signal.
 *
 * Per-tab data correctness is handled at the request layer: each request carries this
 * tab's session token in the Authorization header so the proxy scopes off the per-tab
 * token, not the shared cookie (see lib/api.ts). The React Query cache is reset
 * atomically by remounting `QueryProvider` under `key={org.id}` (lib/query-provider.tsx).
 *
 * Still mounted ABOVE `QueryProvider`: the keyed remount unmounts the authed subtree
 * on switch, so a survivor is the right place for the cache-clear bookkeeping.
 */
export function OrgCacheInvalidator() {
  const { organization } = useOrganization();
  const prevOrgId = useRef<string | null>(null);

  useEffect(() => {
    const currentOrgId = organization?.id ?? null;

    // Skip the initial mount — only act on actual changes. Clear the breadcrumb
    // caches so stale brand/org labels don't linger; NEVER navigate (see above).
    if (
      prevOrgId.current !== null &&
      currentOrgId !== null &&
      prevOrgId.current !== currentOrgId
    ) {
      clearBreadcrumbCaches();
    }

    prevOrgId.current = currentOrgId;
  }, [organization?.id]);

  return null;
}
