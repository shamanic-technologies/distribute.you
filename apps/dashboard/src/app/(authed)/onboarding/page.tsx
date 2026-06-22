"use client";

import { BetaOnboarding } from "@/components/onboarding/beta-onboarding";

// The stepped onboarding flow (ported from the app.distribute.you mockup — animated
// build sequence + strategy review → straight into the brand launch flow) is now GA:
// every signup gets it. (Previously allowlist-gated; gate dropped per the beta→GA
// graduation rule. The old DefaultOnboarding component is retired from this route.)
export default function OnboardingPage() {
  return <BetaOnboarding />;
}
