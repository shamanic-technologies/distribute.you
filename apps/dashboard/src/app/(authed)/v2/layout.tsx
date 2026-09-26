"use client";

import { useUser } from "@clerk/nextjs";
import { OrgActivator } from "@/components/org-activator";
import { UserResolver } from "@/components/user-resolver";
import { BrandFavicon } from "@/components/brand-favicon";
import { BrandTint } from "@/components/brand-tint";
import { QueryProvider } from "@/lib/query-provider";
import { OrgContextProvider } from "@/lib/org-context";
import { FeaturesProvider } from "@/lib/features-context";
import { EntityRegistryProvider } from "@/lib/entity-registry-context";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { isBetaEmail } from "@/lib/beta-allowlist";
import { V2Shell } from "@/components/v2/v2-shell";

/**
 * Dashboard v2 (beta): a second dashboard built beside v1, in production, invisible
 * to customers.
 *
 * It runs on EXACTLY v1's data layer — the same providers, the same api client, the
 * same query keys and the same persisted per-org cache — so a figure reads the same in
 * both, and opening v2 after v1 paints from the cache v1 already filled. Only the
 * chrome and the pages are new.
 *
 * The gate is the beta email allowlist, on the WHOLE tree: anyone else reaching a
 * `/v2` URL gets the not-available state and no data read fires for them. The edge
 * only ever SENDS beta users here; this is the gate for everyone who types the URL.
 */
function BetaGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <div className="h-screen bg-[#f6f6f5]" />;
  if (!isBetaEmail(user?.primaryEmailAddress?.emailAddress)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-900">This page is not available</p>
          <p className="mt-1 text-sm text-gray-500">It is part of a preview that is not open yet.</p>
          <a
            href="/orgs"
            className="mt-4 inline-block rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to your dashboard
          </a>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <BetaGate>
      <QueryProvider>
        <OrgContextProvider>
          <FeaturesProvider>
            <EntityRegistryProvider>
              <BillingGuardProvider>
                <OrgActivator />
                <UserResolver />
                <BrandFavicon />
                <BrandTint />
                <V2Shell>{children}</V2Shell>
              </BillingGuardProvider>
            </EntityRegistryProvider>
          </FeaturesProvider>
        </OrgContextProvider>
      </QueryProvider>
    </BetaGate>
  );
}
