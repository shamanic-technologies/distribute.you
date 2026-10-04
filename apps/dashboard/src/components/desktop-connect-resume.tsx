"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { DESKTOP_CONNECT_PATH, readParkedDesktopConnect } from "@/lib/desktop-connect";

/**
 * Brings a tab back to `/desktop/connect` once the visitor is signed in. Sign-in,
 * Google, the choose-organization task and onboarding each end on their own page, so
 * without this the Mac app would wait forever on a request the user already approved.
 * Does nothing unless the tab parked a request (see `lib/desktop-connect.ts`).
 */
export function DesktopConnectResume() {
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) return;
    if (pathname === DESKTOP_CONNECT_PATH) return;
    if (!readParkedDesktopConnect(window.sessionStorage, Date.now())) return;
    router.replace(DESKTOP_CONNECT_PATH);
  }, [isLoaded, isSignedIn, orgId, pathname, router]);

  return null;
}
