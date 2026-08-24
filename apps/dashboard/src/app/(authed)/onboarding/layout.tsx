import { QueryProvider } from "@/lib/query-provider";
import { BillingGuardProvider } from "@/lib/billing-guard";
import { OnboardingCreditGate } from "@/components/onboarding/onboarding-credit-gate";
import { OnboardingTopChrome } from "@/components/onboarding/onboarding-top-chrome";
import { SupportButton } from "@/components/support/support-button";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider scope="onboarding">
      {/* scope="onboarding": `?new=1` creates a Clerk org mid-flow, so this provider
          must NOT remount when the active org changes — an org-keyed remount wipes the
          wizard's state and drops the user back on the URL step. See query-provider. */}
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
            height) so the iOS Safari address bar never eats the pinned CTA.

            `max-h-[100svh]` is what makes that pinning REAL, and it is
            load-bearing: a min-height alone leaves the column free to grow past
            the viewport, so the flex children divide the GROWN height, the
            scroller declared in StepShell never overflows, the page scrolls
            instead, and the footer rides below the fold. Measured on the welcome
            step before this: the CTA sat at 926px on a 667px screen and on a
            915px one — below the fold on every phone. Capping the column makes
            the height definite, so the body stops scrolling and the step's own
            `overflow-y-auto` region takes over, with the CTA always on screen.
            Reverted at sm+ (`sm:max-h-none`), where the shell is a centered
            floating card and a hard cap would clip a tall step. */}
        <div className="flex max-h-[100svh] min-h-[100svh] flex-col overflow-hidden bg-gray-50 sm:max-h-none sm:overflow-visible">
          <OnboardingTopChrome />
          {/* Mobile: full-bleed, stretch — each step (StepShell) fills the area
              edge-to-edge with no card chrome. sm+: the centered floating-card frame. */}
          <div className="flex min-h-0 flex-1 items-stretch justify-center sm:items-center sm:px-4 sm:py-6">
            <div className="flex w-full min-w-0 max-w-5xl flex-1 flex-col sm:flex-none">
              <OnboardingCreditGate>{children}</OnboardingCreditGate>
            </div>
          </div>
          {/* raised: lifts above the bottom-pinned StepShell CTA on mobile. */}
          <SupportButton raised />
        </div>
      </BillingGuardProvider>
    </QueryProvider>
  );
}
