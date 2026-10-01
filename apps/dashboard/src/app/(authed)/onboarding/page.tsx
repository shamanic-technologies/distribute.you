"use client";

import { Onboarding } from "@/components/onboarding/onboarding";
import { OnboardingEntryPing } from "@/components/onboarding/onboarding-entry-ping";

// The onboarding flow every signup gets: the outcomes a brand wants, its services,
// who it sells to and its offer, then payment, which funds one campaign per
// (leg x channel) those outcomes need.
export default function OnboardingPage() {
  return (
    <>
      <OnboardingEntryPing flow="v1" />
      <Onboarding />
    </>
  );
}
