"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrands } from "@/lib/api";
import { ContextSidebar } from "@/components/context-sidebar";
import { Header } from "@/components/header";
import { OrgActivator } from "@/components/org-activator";
import { AuthEventTracker } from "@/components/auth-event-tracker";
import { UserActivityTracker } from "@/components/user-activity-tracker";
import { UserResolver } from "@/components/user-resolver";
import { OrgCacheInvalidator } from "@/components/org-cache-invalidator";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/mobile-sidebar-context";
import { QueryProvider } from "@/lib/query-provider";
import { OrgContextProvider, useOrg } from "@/lib/org-context";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { FeaturesProvider } from "@/lib/features-context";
import { EntityRegistryProvider } from "@/lib/entity-registry-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useMobileSidebar();
  const { hasOrg, isLoading, isError } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();
  // The brands page receives `?autoCreate=<url>` and creates the first brand
  // in-place; during that window the org has 0 brands but must NOT bounce.
  const autoCreateInFlight = searchParams.get("autoCreate") !== null;

  // First-run gate (DIS-91). A Clerk org is auto-created at signup, so `!hasOrg`
  // never fires for a fresh user — the real first-run signal is an active org
  // with no brand yet. Query the active org's brands and route brand-less orgs
  // into onboarding. `enabled: hasOrg` keeps it from firing before the org
  // resolves; `brandsError` is treated as "unknown" (no redirect → no loop).
  const {
    data: brandsData,
    isPending: brandsPending,
    isError: brandsError,
  } = useAuthQuery(["brands"], () => listBrands(), { enabled: hasOrg });

  const orgHasNoBrands =
    hasOrg &&
    !brandsPending &&
    !brandsError &&
    (brandsData?.brands.length ?? 0) === 0;

  const redirectingToOnboarding =
    !isLoading &&
    !isError &&
    (!hasOrg || (orgHasNoBrands && !autoCreateInFlight));

  useEffect(() => {
    if (isLoading || isError) return;
    if (redirectingToOnboarding) {
      router.push("/onboarding");
    }
  }, [isLoading, isError, redirectingToOnboarding, router]);

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
  const showContent = !isLoading && hasOrg && !redirectingToOnboarding;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <OrgActivator />
      <OrgCacheInvalidator />
      <AuthEventTracker />
      <UserActivityTracker />
      <UserResolver />
      <Header />
      <div className="flex flex-1 overflow-hidden relative">
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

        {/* Desktop sidebar — always shown, content adapts via ContextSidebar */}
        <div className="hidden md:flex h-full">
          <ContextSidebar />
        </div>

        <main className="flex-1 overflow-y-auto">
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
  );
}
