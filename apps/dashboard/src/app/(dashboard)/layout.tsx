"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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

  useEffect(() => {
    if (!isLoading && !hasOrg && !isError) {
      router.push("/onboarding");
    }
  }, [isLoading, hasOrg, isError, router]);

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

  if (isLoading || !hasOrg) {
    return <div className="h-screen bg-gray-50" />;
  }

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

        <main className="flex-1 overflow-y-auto">{children}</main>
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
