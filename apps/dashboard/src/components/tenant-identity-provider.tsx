"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";
import {
  mergeTenantIdentity,
  readTenantIdentityFromDocumentCookie,
  tenantIdentityCookieAssignment,
  type RememberedBrand,
  type RememberedOrg,
  type TenantIdentitySnapshot,
} from "@/lib/tenant-identity-cookie";

interface TenantIdentityContextValue {
  /** The snapshot the SERVER read out of the cookie — available on the first frame. */
  seed: TenantIdentitySnapshot | null;
  /** Persist a freshly-resolved identity so the NEXT load paints it server-side. */
  remember: (update: {
    orgId?: string | null;
    org?: RememberedOrg | null;
    brandId?: string | null;
    brand?: RememberedBrand | null;
  }) => void;
}

const TenantIdentityContext = createContext<TenantIdentityContextValue>({
  seed: null,
  remember: () => {},
});

/**
 * Carries the server-read tenant identity into the client tree.
 *
 * The value is passed down as a PROP from a server layout, so the switcher renders
 * the real org name / brand name / brand logo into the SSR HTML — on screen before
 * any JS runs — and the client hydrates against the identical value (no mismatch,
 * no flash). The React Query + IndexedDB path still owns freshness; this only owns
 * the first frame, which IndexedDB cannot reach because its read is asynchronous.
 *
 * `remember` writes back through `document.cookie`, deliberately un-memoised on the
 * snapshot: it re-reads the live cookie each time so two tabs resolving different
 * tenants merge instead of clobbering each other.
 */
export function TenantIdentityProvider({
  seed,
  children,
}: {
  seed: TenantIdentitySnapshot | null;
  children: ReactNode;
}) {
  // Mirrors what we last wrote, purely to skip a redundant cookie assignment when a
  // poll re-resolves the same name. The live cookie is still the source of truth.
  const lastWritten = useRef<TenantIdentitySnapshot | null>(seed);

  const remember = useCallback<TenantIdentityContextValue["remember"]>((update) => {
    if (typeof document === "undefined") return;
    const current = readTenantIdentityFromDocumentCookie(document.cookie);
    const next = mergeTenantIdentity(current, update);
    // mergeTenantIdentity returns the SAME reference when nothing changed.
    if (next === current) return;
    if (lastWritten.current === next) return;
    lastWritten.current = next;
    document.cookie = tenantIdentityCookieAssignment(next);
  }, []);

  return (
    <TenantIdentityContext.Provider value={{ seed, remember }}>
      {children}
    </TenantIdentityContext.Provider>
  );
}

export function useTenantIdentity(): TenantIdentityContextValue {
  return useContext(TenantIdentityContext);
}
