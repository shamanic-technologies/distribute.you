"use client";

import { useEffect, useRef, useState } from "react";
import { finishGoogleConnect, setApiActiveOrgOverride } from "@/lib/api";
import { GOOGLE_RETURN_KEY, parseGoogleReturn, returnWithOutcome } from "@/lib/google-connect";

/**
 * Where Google sends the browser back after a Gmail sign-in. This exact path is the
 * one registered on the Google OAuth client (see `lib/google-connect.ts`), so it
 * cannot move without a Cloud console change.
 *
 * It relays `code` + `state` to google-service for the org the trip was started
 * for, then returns to the page it was started from with the outcome. Runs once:
 * a Google code is single-use, so a second exchange would fail on a mailbox that
 * just connected.
 */
export default function GoogleOAuthCallbackPage() {
  const ran = useRef(false);
  const [message, setMessage] = useState("Connecting your Gmail…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.search);
    const trip = parseGoogleReturn(window.sessionStorage.getItem(GOOGLE_RETURN_KEY));
    window.sessionStorage.removeItem(GOOGLE_RETURN_KEY);
    const back = (url: string) => window.location.replace(url);

    if (!trip) {
      console.error("[google-connect] callback reached with no trip started in this tab");
      setMessage("This sign-in was not started from this tab. Go back to Integrations and connect again.");
      return;
    }
    const denied = params.get("error");
    const code = params.get("code");
    const state = params.get("state");
    if (denied || !code || !state) {
      console.error("[google-connect] Google returned no code", { denied });
      back(returnWithOutcome(trip.returnTo, { error: denied === "access_denied" ? "You cancelled the Google sign-in." : "Google did not finish the sign-in. Try again." }));
      return;
    }
    setApiActiveOrgOverride(trip.orgId);
    finishGoogleConnect(code, state)
      .then(() => back(returnWithOutcome(trip.returnTo, { connected: true })))
      .catch((err: unknown) => {
        console.error("[google-connect] finishing the connection failed", err);
        back(returnWithOutcome(trip.returnTo, { error: "We could not connect this mailbox. Try again." }));
      })
      .finally(() => setApiActiveOrgOverride(null));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  );
}
