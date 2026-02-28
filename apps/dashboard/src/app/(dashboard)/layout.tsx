"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ContextSidebar } from "@/components/context-sidebar";
import { Header } from "@/components/header";
import { OrgActivator } from "@/components/org-activator";
import { UserActivityTracker } from "@/components/user-activity-tracker";
import { MobileSidebarProvider, useMobileSidebar } from "@/components/mobile-sidebar-context";
import { ChatWidget } from "@/components/chat/chat-widget";
import { QueryProvider } from "@/lib/query-provider";
import { AppContextProvider, useApp } from "@/lib/app-context";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useMobileSidebar();
  const { hasApp, isLoading, isError } = useApp();
  const router = useRouter();

  useEffect(() => {
    // Only redirect to onboarding when we're SURE the user has no app.
    // If the API errored (CORS, network, auth), do NOT redirect — that
    // would cause an infinite loop between dashboard and onboarding.
    if (!isLoading && !hasApp && !isError) {
      router.push("/onboarding");
    }
  }, [isLoading, hasApp, isError, router]);

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

  // Don't render dashboard chrome while checking onboarding status
  if (isLoading || !hasApp) {
    return <div className="h-screen bg-gray-50" />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <OrgActivator />
      <UserActivityTracker />
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
      <ChatWidget />
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
        <AppContextProvider>
          <DashboardContent>{children}</DashboardContent>
        </AppContextProvider>
      </MobileSidebarProvider>
    </QueryProvider>
  );
}
