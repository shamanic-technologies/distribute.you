"use client";

import { OrgActivator } from "@/components/org-activator";
import { UserResolver } from "@/components/user-resolver";
import { BrandFavicon } from "@/components/brand-favicon";
import { BrandTint } from "@/components/brand-tint";
import { AuthEventTracker } from "@/components/auth-event-tracker";
import { AdsPurchaseTracker } from "@/components/ads-purchase-tracker";
import { DistributeSaleTracker } from "@/components/distribute-sale-tracker";
import { InviteClaimer } from "@/components/invite/invite-claimer";
import { QueryProvider } from "@/lib/query-provider";
import { OrgContextProvider } from "@/lib/org-context";
import { FeaturesProvider } from "@/lib/features-context";
import { EntityRegistryProvider } from "@/lib/entity-registry-context";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { V2Shell } from "@/components/v2/v2-shell";

/**
 * Dashboard v2: the only dashboard (v1 was deleted; it lives in git history).
 *
 * The headless side effects below used to ride the v1 shell only, so v2 users never
 * got them: the signup/welcome notification, the Stripe-return purchase conversions
 * (a top-up returns to the v2 Billing page with `?success=true`) and the referral
 * claim that credits both orgs. They mount here now, the one authed dashboard shell.
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
                <AuthEventTracker />
                <AdsPurchaseTracker />
                <DistributeSaleTracker />
                <InviteClaimer />
                <V2Shell>{children}</V2Shell>
              </BillingGuardProvider>
            </EntityRegistryProvider>
          </FeaturesProvider>
        </OrgContextProvider>
      </QueryProvider>
    </>
  );
}
