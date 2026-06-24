"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { WELCOME_STEPS } from "@/lib/onboarding-content";
import { welcomeSeenKey } from "@/lib/onboarding-reminders";

/**
 * First-visit welcome flow: a 5-card guided sequence (driver.js) shown once per
 * user. Centered explainer cards plus a final spotlight on the Audiences nav.
 * Fires on mount when the per-user localStorage flag is absent; on finish (or
 * skip) it sets the flag and calls `onComplete` so the reminder modals can take
 * over. Self-contained — no backend write (the org-level onboardingComplete gate
 * already passed; this is a dashboard reassurance flow, not a routing gate).
 */
export function WelcomeTour({ onComplete }: { onComplete?: () => void }) {
  const { user, isLoaded } = useUser();
  const params = useParams();
  const orgId = params?.orgId as string | undefined;
  const brandId = params?.brandId as string | undefined;
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoaded || !user) return;
    if (startedRef.current) return;

    const key = welcomeSeenKey(user.id);
    if (localStorage.getItem(key)) return;
    startedRef.current = true;

    const steps: DriveStep[] = WELCOME_STEPS.map((s) => ({
      popover: {
        title: s.title,
        description: s.description,
        side: "over" as const,
        align: "center" as const,
      },
    }));

    // Spotlight the Audiences nav on the final "find your best audience" step,
    // but only on desktop where the sidebar link is visible. On mobile the
    // sidebar is a hidden drawer, so the step stays a centered card.
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop && orgId && brandId) {
      const selector = `a[href$="/orgs/${orgId}/brands/${brandId}/audiences"]`;
      if (document.querySelector(selector)) {
        steps[steps.length - 1] = {
          element: selector,
          popover: {
            title: WELCOME_STEPS[WELCOME_STEPS.length - 1].title,
            description: WELCOME_STEPS[WELCOME_STEPS.length - 1].description,
          },
        };
      }
    }

    const markSeen = () => {
      localStorage.setItem(key, "1");
      onComplete?.();
    };

    const tour = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: "#0f172a",
      overlayOpacity: 0.6,
      stagePadding: 6,
      popoverClass: "distribute-tour",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Get started",
      steps,
      onDestroyed: markSeen,
    });

    tour.drive();

    return () => {
      tour.destroy();
    };
  }, [isLoaded, user, orgId, brandId, onComplete]);

  return null;
}
