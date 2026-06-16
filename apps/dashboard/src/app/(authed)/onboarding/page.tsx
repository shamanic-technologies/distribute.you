"use client";

import { useUser } from "@clerk/nextjs";
import { isBetaEmail } from "@/lib/beta-allowlist";
import { LegacyOnboarding } from "@/components/onboarding/legacy-onboarding";
import { BetaOnboarding } from "@/components/onboarding/beta-onboarding";

// Beta team (allowlist) gets the new stepped flow ported from the app.distribute.you
// mockup — animated build sequence + strategy review → straight into campaigns/new.
// Everyone else keeps the legacy flow. Gate on the Clerk email; render nothing until
// the user resolves so neither flow flashes before the allowlist is known.
export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  if (!isLoaded) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }
  return isBetaEmail(user?.primaryEmailAddress?.emailAddress) ? (
    <BetaOnboarding />
  ) : (
    <LegacyOnboarding />
  );
}
