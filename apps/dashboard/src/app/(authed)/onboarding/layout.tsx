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
        {/* Mobile app-shell column: a slim in-flow top bar (shrink-0), then the
            step body fills the rest (flex-1) so StepShell can pin its footer/CTA
            to the bottom without a floating overlay. `100svh` (small viewport
            height) so the iOS Safari address bar never eats the pinned CTA. */}
        <div className="flex min-h-[100svh] flex-col bg-gray-50">
          <OnboardingTopChrome />
          {/* Mobile: full-bleed, stretch — each step (StepShell) fills the area
              edge-to-edge with no card chrome. sm+: the centered floating-card frame. */}
          <div className="flex min-h-0 flex-1 items-stretch justify-center sm:items-center sm:px-4 sm:py-6">
            <div className="flex w-full min-w-0 max-w-5xl flex-1 flex-col sm:flex-none">
              <OnboardingCreditGate>{children}</OnboardingCreditGate>
            </div>
          </div>
        </div>
      </BillingGuardProvider>
    </QueryProvider>
  );
}
