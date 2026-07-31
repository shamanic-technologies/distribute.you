"use client";

import { useEffect } from "react";
import { inviteCodeFromSearch, inviteCookieWrite } from "@/lib/invite-link";

/**
 * Catches the referral code forwarded from the landing (`?invite=CODE`) and puts
 * it in a first-party cookie on the dashboard domain, so it survives the Clerk
 * sign-up / OAuth redirect and is still there when an org finally exists.
 *
 * Byte-for-byte the same journey the Partnero partner key takes (see
 * `PartneroViaCapture`), for the same reason: the link lands on `distribute.you`
 * and the signup happens on `dashboard.distribute.you`, so nothing but a
 * first-party cookie crosses the gap.
 *
 * Reads `window.location.search` rather than `useSearchParams` to avoid forcing
 * a Suspense boundary onto the root layout.
 *
 * This only REMEMBERS the code. `InviteClaimer` is what spends it, and it does so
 * on its own schedule, because at capture time there is usually no org yet.
 */
export function InviteCapture() {
  useEffect(() => {
    try {
      const code = inviteCodeFromSearch(window.location.search);
      if (!code) return;
      document.cookie = inviteCookieWrite(code);
    } catch {
      // Best-effort — a referral must never block the page from loading.
    }
  }, []);

  return null;
}
