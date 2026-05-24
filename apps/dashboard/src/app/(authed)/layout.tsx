import { ClerkProvider } from "@clerk/nextjs";
import { PostHogAuthTracker } from "@/components/posthog-auth-tracker";

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
 */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider dynamic>
      <PostHogAuthTracker />
      {children}
    </ClerkProvider>
  );
}
