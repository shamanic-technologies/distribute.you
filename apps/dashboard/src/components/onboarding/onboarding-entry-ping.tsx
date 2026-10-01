"use client";

import { useEffect } from "react";
import {
  ENTRY_PING_STORAGE_KEY,
  isOnboardingEntry,
  type OnboardingFlow,
} from "@/lib/onboarding-entry-ping";

/**
 * Pings the owner's Telegram once per browser session when someone reaches the
 * first page of onboarding (`lib/onboarding-entry-ping.ts`). Renders nothing, and
 * nothing the visitor sees waits on it.
 */
export function OnboardingEntryPing({ flow }: { flow: OnboardingFlow }) {
  useEffect(() => {
    if (!isOnboardingEntry(window.location.search)) return;
    if (sessionStorage.getItem(ENTRY_PING_STORAGE_KEY)) return;
    sessionStorage.setItem(ENTRY_PING_STORAGE_KEY, "1");
    const url = new URLSearchParams(window.location.search).get("url");
    void fetch("/api/public/onboarding-entry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ flow, url }),
      keepalive: true,
    }).catch((err: unknown) => console.error("[dashboard/onboarding-entry] ping failed:", err));
  }, [flow]);
  return null;
}
