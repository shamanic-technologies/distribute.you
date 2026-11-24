"use client";

import { useEffect, useRef, useState } from "react";
import {
  instagramDeniedMessage,
  instagramReturnUrl,
  instagramTripKey,
  parseInstagramTrip,
} from "@/lib/instagram-connect";

/**
 * Where Instagram sends the browser back after its login (REELS-1124).
 * This exact URL is the one registered on our Instagram app (`INSTAGRAM_PROD_REDIRECT_URI`),
 * so it carries no org or brand and cannot move without a Meta developer console change.
 *
 * It finishes nothing itself: it reads the trip remembered under Instagram's `state`
 * and goes back to the Account page it was started from, handing it `code` +
 * `state` (Instagram's trailing `#_` dropped). The Account page's Instagram card makes
 * the call under its own URL org, so the org check of every dashboard call holds as usual.
 * A declined login (`error=access_denied`) goes back with the reason; every dead end
 * ends on a sentence, never on the waiting line.
 */
export default function InstagramCallbackPage() {
  const ran = useRef(false);
  const [message, setMessage] = useState("Connecting your Instagram account…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const code = params.get("code");
    const denied = params.get("error");
    const key = state ? instagramTripKey(state) : null;
    const trip = key ? parseInstagramTrip(window.localStorage.getItem(key)) : null;
    if (key) window.localStorage.removeItem(key);

    if (!trip) {
      console.error("[instagram-connect] callback reached with no trip started in this browser", { hasState: !!state, denied });
      setMessage(
        denied
          ? `${instagramDeniedMessage(denied)} Go back to your Accounts page to connect again.`
          : "This Instagram login was not started here. Go back to your Accounts page and connect again.",
      );
      return;
    }
    if (!code || !state) {
      console.error("[instagram-connect] Instagram returned no code", { denied, reason: params.get("error_reason") });
      window.location.replace(instagramReturnUrl(trip.returnTo, { error: instagramDeniedMessage(denied) }));
      return;
    }
    window.location.replace(instagramReturnUrl(trip.returnTo, { code, state }));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  );
}
