"use client";

import { useRef } from "react";
import { ContextSidebar } from "@/components/context-sidebar";
import { Header } from "@/components/header";
import { OrgActivator } from "@/components/org-activator";
import { AuthEventTracker } from "@/components/auth-event-tracker";
import { AdsPurchaseTracker } from "@/components/ads-purchase-tracker";
import { UserActivityTracker } from "@/components/user-activity-tracker";
import { UserResolver } from "@/components/user-resolver";
import { OrgCacheInvalidator } from "@/components/org-cache-invalidator";
import { CreditAlerts } from "@/components/billing/credit-alerts";
import { NoAudienceBanner } from "@/components/onboarding/no-audience-banner";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/mobile-sidebar-context";
import { QueryProvider } from "@/lib/query-provider";
import { OrgContextProvider, useOrg } from "@/lib/org-context";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { FeaturesProvider } from "@/lib/features-context";
import { EntityRegistryProvider } from "@/lib/entity-registry-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useMobileSidebar();
  const { hasOrg, isLoading, isError } = useOrg();

  // First-run routing is decided at the edge (proxy.ts / DIS-111) from a session
  // claim — a user who reaches the dashboard already has an onboarded org. This
  // layout only handles org-loading + connection-error states; it no longer
  // redirects to onboarding (that was the flash-prone client gate, #1229).

  if (isError) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-gray-900 font-medium mb-2">Unable to connect</p>
          <p className="text-gray-500 text-sm mb-4">We couldn&apos;t reach the server. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Keep the layout shell mounted across Clerk re-loads so React Query observers in `children`
  // don't unmount, lose their data references, and re-paint as skeletons when Clerk briefly
  // flips back to `isLoading`. Only the main content area swaps to a skeleton when we
  // genuinely have no org (initial app load or sign-out).
  //
  // Monotonic readiness latch: Clerk flips `isLoaded` back to false (and `organization` can
  // blink null) during background session-JWT rotation / revalidation. Gating the body on the
  // live `!isLoading` made the whole `<main>` disappear and reappear every rotation. Once the
  // org has resolved at least once, keep the body mounted — only blank before the FIRST resolve.
  // The ref resets naturally on sign-out (the whole layout unmounts).
  const hasResolvedOnce = useRef(false);
  if (!isLoading && hasOrg) hasResolvedOnce.current = true;
  const showContent = hasResolvedOnce.current || (!isLoading && hasOrg);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <OrgActivator />
      <AuthEventTracker />
      <AdsPurchaseTracker />
      <UserActivityTracker />
      <UserResolver />
      <Header />
      <CreditAlerts />
      <NoAudienceBanner />
      <OnboardingFlow />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={close}
          />
        )}

        {/* Mobile sidebar drawer */}
        <div className={`
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out md:hidden
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <ContextSidebar />
        </div>

        {/* Desktop sidebar — content adapts via ContextSidebar */}
        <div className="hidden md:flex h-full">
          <ContextSidebar />
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {showContent ? children : <div className="h-full bg-gray-50" />}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Mounted ABOVE QueryProvider on purpose: the QueryProvider remounts the
          whole authed subtree under `key={org.id}` to reset the cache on org
          switch, so the org-change navigator must live outside it to survive that
          remount and fire its router.push. */}
      <OrgCacheInvalidator />
      <QueryProvider>
        <MobileSidebarProvider>
          <OrgContextProvider>
            <FeaturesProvider>
              <EntityRegistryProvider>
                <BillingGuardProvider>
                  <DashboardContent>{children}</DashboardContent>
                </BillingGuardProvider>
              </EntityRegistryProvider>
            </FeaturesProvider>
          </OrgContextProvider>
        </MobileSidebarProvider>
      </QueryProvider>
    </>
  );
}
