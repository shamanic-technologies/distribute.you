import { cookies } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { PostHogAuthTracker } from "@/components/posthog-auth-tracker";
import { ConversionPing } from "@/components/conversion-ping";
import { TenantIdentityProvider } from "@/components/tenant-identity-provider";
import {
  TENANT_IDENTITY_COOKIE,
  parseTenantIdentityCookie,
} from "@/lib/tenant-identity-cookie";

/**
 * Authed-tree layout. Wraps every dashboard / onboarding / sign-in / api /
 * claim / services / sso-callback route with `<ClerkProvider dynamic>`.
 *
 * Lives here (not at the root layout) so the public `/report/*` tree
 * escapes the `dynamic` rendering bit Clerk forces. Without this split,
 * `export const revalidate = N` on report pages is silently ignored —
 * every visitor would re-render server-side and the 4h ISR cache built
 * by `unstable_cache` would never materialise as static HTML.
 *
 * The `dynamic` prop itself is regression-guarded by
 * `tests/clerk-v6-orgid.regression.test.ts` — required for Next.js 15
 * async `headers()` compatibility (v5 returned `auth().orgId = undefined`
 * because `headers()` resolved after `auth()` did).
 *
 * It also reads the last-known tenant identity out of its cookie and hands it to
 * the client tree. That read HAS to happen on the server: the identity otherwise
 * lives only in the async IndexedDB query cache, which cannot be reached before
 * the first paint, so every hard refresh rendered `Brand` + the globe placeholder
 * and swapped the real values in afterwards. Reading it here puts the real name
 * and logo in the HTML itself. Cheap (one cookie, no I/O) and it adds no dynamic
 * bit — `ClerkProvider dynamic` already opted this whole subtree out of static
 * rendering, and `/report/*` sits OUTSIDE it, so the ISR split above is untouched.
 * The `loading.tsx` boundaries live under `(dashboard)`, well below this layout,
 * so their fallbacks are unaffected too.
 */
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const tenantSeed = parseTenantIdentityCookie(
    cookieStore.get(TENANT_IDENTITY_COOKIE)?.value,
  );

  return (
    <ClerkProvider
      dynamic
      taskUrls={{
        "choose-organization": "/session-tasks/choose-organization",
      }}
    >
      <TenantIdentityProvider seed={tenantSeed}>
        <PostHogAuthTracker />
        <ConversionPing />
        {children}
      </TenantIdentityProvider>
    </ClerkProvider>
  );
}
