"use client";

import { useEffect } from "react";
import {
  DISTRIBUTE_CONVERSION_TOKEN,
  DISTRIBUTE_CONVERSION_INGEST_URL,
} from "@/lib/distribute-conversion";

// Page-load liveness ping for distribute's OWN conversion tracker. Fires
// {event:"ping"} (no identity fields) once per browser session so our conversion
// system can confirm distribute's tracker is live — and show it as "Live" in the
// Conversion Tracking settings — before the first real signup lands. This is the
// exact heartbeat the client snippet fires; we dogfood it here. Liveness only:
// lead-service records lastPingAt and does NOT attribute it or count it as a
// conversion. Fire-and-forget — a failed ping must never affect the page.
const PING_SESSION_KEY = "distribute_conversion_pinged";

export function ConversionPing() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(PING_SESSION_KEY)) return;
      sessionStorage.setItem(PING_SESSION_KEY, "1");
    } catch {
      // sessionStorage unavailable (private mode / blocked) — still ping once
      // per mount rather than not at all.
    }

    void fetch(DISTRIBUTE_CONVERSION_INGEST_URL, {
      method: "POST",
      headers: {
        "x-conversion-token": DISTRIBUTE_CONVERSION_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event: "ping" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
