"use client";

import { useEffect, useRef, useState } from "react";
import { parseXTrip, xReturnUrl, xTripKey } from "@/lib/x-connect";

/**
 * Where X sends the browser back after its login (X-ACCOUNTS-1030).
 * This exact URL is the one registered on our X app (`X_PROD_REDIRECT_URI`),
 * so it carries no org or brand and cannot move without an X developer console change.
 *
 * It finishes nothing itself: it reads the trip remembered under X' `state`
 * and goes back to the Account page it was started from, handing it `code` +
 * `state`. The Account page's X card makes the call under its own URL org,
 * so the org check of every dashboard call holds as usual.
 */
export default function XCallbackPage() {
  const ran = useRef(false);
  const [message, setMessage] = useState("Connecting your X account…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const code = params.get("code");
    const key = state ? xTripKey(state) : null;
    const trip = key ? parseXTrip(window.localStorage.getItem(key)) : null;
    if (key) window.localStorage.removeItem(key);

    if (!trip) {
      console.error("[x-connect] callback reached with no trip started in this browser", { hasState: !!state });
      setMessage("This X login was not started here. Go back to your Account page and connect again.");
      return;
    }
    if (!code || !state) {
      const denied = params.get("error");
      console.error("[x-connect] X returned no code", { denied, reason: params.get("error_reason") });
      window.location.replace(
        xReturnUrl(trip.returnTo, {
          error: denied === "access_denied" ? "You cancelled the X login." : "X did not finish the login. Try again.",
        }),
      );
      return;
    }
    window.location.replace(xReturnUrl(trip.returnTo, { code, state }));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  );
}
