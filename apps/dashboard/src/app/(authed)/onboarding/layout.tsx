import { QueryProvider } from "@/lib/query-provider";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { OnboardingCreditGate } from "@/components/onboarding/onboarding-credit-gate";
import { OnboardingTopChrome } from "@/components/onboarding/onboarding-top-chrome";

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
        {/* Top chrome: just the account widget for first-run signup (focused, no
            escape), OR the full breadcrumb switcher + logo + Cancel when an existing
            user enters via ?from=add / ?new=1 (escape hatch back to any org×brand). */}
        <OnboardingTopChrome />
        {/* Mobile: full-bleed, stretch — each step (StepShell) fills the viewport
            edge-to-edge with no card chrome. sm+: the centered floating-card frame. */}
        <div className="flex min-h-dvh items-stretch justify-center bg-gray-50 sm:items-center sm:px-4 sm:py-6">
          <div className="w-full max-w-5xl min-w-0">
            <OnboardingCreditGate>{children}</OnboardingCreditGate>
          </div>
        </div>
      </BillingGuardProvider>
    </QueryProvider>
  );
}
