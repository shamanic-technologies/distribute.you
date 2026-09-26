"use client";

import { OrgActivator } from "@/components/org-activator";
import { UserResolver } from "@/components/user-resolver";
import { BrandFavicon } from "@/components/brand-favicon";
import { BrandTint } from "@/components/brand-tint";
import { QueryProvider } from "@/lib/query-provider";
import { OrgContextProvider } from "@/lib/org-context";
import { FeaturesProvider } from "@/lib/features-context";
import { EntityRegistryProvider } from "@/lib/entity-registry-context";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { V2Shell } from "@/components/v2/v2-shell";

/**
 * Dashboard v2: the default dashboard for every signed-in user, built beside v1.
 *
 * It runs on EXACTLY v1's data layer — the same providers, the same api client, the
 * same query keys and the same persisted per-org cache — so a figure reads the same in
 * both, and opening v2 after v1 paints from the cache v1 already filled. Only the
 * chrome and the pages are new.
 */
export function V2ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
