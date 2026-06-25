"use client";

import { Onboarding } from "@/components/onboarding/onboarding";

// The stepped onboarding flow (ported from the app.distribute.you mockup — animated
// build sequence + strategy review → straight into the brand launch flow) is GA:
// every signup gets it. (Previously allowlist-gated; gate dropped per the beta→GA
// graduation rule. The old DefaultOnboarding component is retired from this route.)
export default function OnboardingPage() {
  return <Onboarding />;
}
