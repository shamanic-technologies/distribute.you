"use client";

import { useEffect, useRef, useState } from "react";
import { parseThreadsTrip, threadsReturnUrl, threadsTripKey } from "@/lib/threads-connect";

/**
 * Where Threads sends the browser back after its login (THREADS-ACCOUNT-CARD-1028).
 * This exact URL is the one registered on our Meta app (`THREADS_PROD_REDIRECT_URI`),
 * so it carries no org or brand and cannot move without a Meta console change.
 *
 * It finishes nothing itself: it reads the trip remembered under Threads' `state`
 * and goes back to the Account page it was started from, handing it `code` +
 * `state`. The Account page's Threads card makes the call under its own URL org,
 * so the org check of every dashboard call holds as usual.
 */
export default function ThreadsCallbackPage() {
  const ran = useRef(false);
  const [message, setMessage] = useState("Connecting your Threads account…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");
    const code = params.get("code");
    const key = state ? threadsTripKey(state) : null;
    const trip = key ? parseThreadsTrip(window.localStorage.getItem(key)) : null;
    if (key) window.localStorage.removeItem(key);

    if (!trip) {
      console.error("[threads-connect] callback reached with no trip started in this browser", { hasState: !!state });
      setMessage("This Threads login was not started here. Go back to your Account page and connect again.");
      return;
    }
    if (!code || !state) {
      const denied = params.get("error");
      console.error("[threads-connect] Threads returned no code", { denied, reason: params.get("error_reason") });
      window.location.replace(
        threadsReturnUrl(trip.returnTo, {
          error: denied === "access_denied" ? "You cancelled the Threads login." : "Threads did not finish the login. Try again.",
        }),
      );
      return;
    }
    window.location.replace(threadsReturnUrl(trip.returnTo, { code, state }));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  );
}
