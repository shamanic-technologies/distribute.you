import { Suspense } from "react";
import { GetStarted } from "@/components/v2/get-started/get-started";
import { OnboardingEntryPing } from "@/components/onboarding/onboarding-entry-ping";

export default function GetStartedPage() {
  return (
    <>
      <OnboardingEntryPing flow="v2" />
      <Suspense fallback={null}>
        <GetStarted />
      </Suspense>
    </>
  );
}
