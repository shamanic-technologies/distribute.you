"use client";

import { useEffect, useRef, useState } from "react";
import { finishGoogleConnect, setApiActiveOrgOverride } from "@/lib/api";
import { GOOGLE_RETURN_KEY, finishErrorMessage, parseGoogleReturn, returnWithOutcome } from "@/lib/google-connect";

/**
 * Where Google sends the browser back after a Gmail or Google Calendar sign-in. This exact path is the
 * one registered on the Google OAuth client (see `lib/google-connect.ts`), so it
 * cannot move without a Cloud console change.
 *
 * It relays `code` + `state` to google-service for the org the trip was started
 * for, then returns to the page it was started from with the outcome. Runs once:
 * a Google code is single-use, so a second exchange would fail on a mailbox that
 * just connected. The outcome goes back to the row the trip was started from (the
 * trip remembers its connection; the Gmail row reads `gmail`/`gmailError` as before).
 */
export default function GoogleOAuthCallbackPage() {
  const ran = useRef(false);
  const [message, setMessage] = useState("Connecting your Google account…");

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
      back(returnWithOutcome(trip.returnTo, { error: denied === "access_denied" ? "You cancelled the Google sign-in." : "Google did not finish the sign-in. Try again." }, trip.connection));
      return;
    }
    setApiActiveOrgOverride(trip.orgId);
    setMessage(trip.connection === "calendar" ? "Connecting your Google Calendar…" : "Connecting your Gmail…");
    finishGoogleConnect(code, state)
      .then((done) => {
        if (done.connection && done.connection !== trip.connection) {
          console.error("[google-connect] callback stored another connection than the trip started", { trip: trip.connection, stored: done.connection });
        }
        back(returnWithOutcome(trip.returnTo, { connected: true }, done.connection ?? trip.connection));
      })
      .catch((err: unknown) => {
        console.error("[google-connect] finishing the connection failed", err);
        back(returnWithOutcome(trip.returnTo, { error: finishErrorMessage(trip.connection, err) }, trip.connection));
      })
      .finally(() => setApiActiveOrgOverride(null));
  }, []);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <p className="text-sm text-gray-600">{message}</p>
    </main>
  );
}
