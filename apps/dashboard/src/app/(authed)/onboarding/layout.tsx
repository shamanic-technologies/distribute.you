import { QueryProvider } from "@/lib/query-provider";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { OnboardingCreditGate } from "@/components/onboarding/onboarding-credit-gate";
import { OnboardingAccountWidget } from "@/components/onboarding/onboarding-account-widget";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      {/* BillingGuardProvider listens for the `billing:payment-required` event that
          apiCall dispatches on any 402, so an insufficient-credit failure ANYWHERE in
          onboarding opens the add-credit modal (in-modal Embedded Checkout) instead of
          a dead error. Mirrors the dashboard layout; onboarding lives outside it. */}
      <BillingGuardProvider>
        <div className="fixed top-4 right-4 z-50">
          <OnboardingAccountWidget />
        </div>
        <div className="flex min-h-dvh items-start justify-center bg-gray-50 px-3 py-4 sm:items-center sm:px-4 sm:py-6">
          <div className="w-full max-w-2xl min-w-0">
            <OnboardingCreditGate>{children}</OnboardingCreditGate>
          </div>
        </div>
      </BillingGuardProvider>
    </QueryProvider>
  );
}
