"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { WelcomeTour } from "./welcome-tour";
import { OnboardingReminders } from "./onboarding-reminders";
import { welcomeSeenKey } from "@/lib/onboarding-reminders";

/**
 * Orchestrates the first-visit onboarding sequence: the welcome tour runs first
 * (once per user), then the state-based reminder modals take over. A returning
 * user who already saw the tour skips straight to the reminders. Mounted once in
 * the dashboard layout. The persistent no-audience banner is a separate surface
 * (NoAudienceBanner) placed in the alerts row.
 */
export function OnboardingFlow() {
  const { user, isLoaded } = useUser();
  const [welcomeDone, setWelcomeDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoaded || !user) return;
    if (localStorage.getItem(welcomeSeenKey(user.id))) setWelcomeDone(true);
  }, [isLoaded, user]);

  return (
    <>
      <WelcomeTour onComplete={() => setWelcomeDone(true)} />
      {welcomeDone && <OnboardingReminders />}
    </>
  );
}
