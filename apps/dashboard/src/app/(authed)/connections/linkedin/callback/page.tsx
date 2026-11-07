"use client";

import { useEffect, useRef, useState } from "react";
import { linkedinDeniedMessage, parseLinkedinTrip, linkedinReturnUrl, linkedinTripKey } from "@/lib/linkedin-connect";

/**
 * Where LinkedIn sends the browser back after its login (LINKEDIN-ACCOUNTS-1106).
 * This exact URL is the one registered on our LinkedIn app (`LINKEDIN_PROD_REDIRECT_URI`),
 * so it carries no org or brand and cannot move without a LinkedIn developer console change.
 *
 * It finishes nothing itself: it reads the trip remembered under LinkedIn's `state`
 * and goes back to the Account page it was started from, handing it `code` +
 * `state`. The Account page's LinkedIn card makes the call under its own URL org,
 * so the org check of every dashboard call holds as usual.
 */
export default function LinkedinCallbackPage() {
  const ran = useRef(false);
  const [message, setMessage] = useState("Connecting your LinkedIn account…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const code = params.get("code");
    const key = state ? linkedinTripKey(state) : null;
    const trip = key ? parseLinkedinTrip(window.localStorage.getItem(key)) : null;
    if (key) window.localStorage.removeItem(key);

    if (!trip) {
      console.error("[linkedin-connect] callback reached with no trip started in this browser", { hasState: !!state });
      setMessage("This LinkedIn login was not started here. Go back to your Account page and connect again.");
      return;
    }
    if (!code || !state) {
      const denied = params.get("error");
      console.error("[linkedin-connect] LinkedIn returned no code", { denied, reason: params.get("error_reason") });
      window.location.replace(linkedinReturnUrl(trip.returnTo, { error: linkedinDeniedMessage(denied, params.get("error_description")) }));
      return;
    }
    window.location.replace(linkedinReturnUrl(trip.returnTo, { code, state }));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  );
}
