"use client";

import { useState } from "react";
import { getBrandConversionToken, type BrandConversionToken } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";

// Per-brand conversion tracking. The client wires our tracker into their own site;
// when a lead we emailed signs up, books a meeting, or submits a form, the event reaches us and lead-service attributes it back to that lead.
// The token is a publishable write-key (it can only POST events for this one
// brand), so it is safe inside the copied instructions and in a browser
// fetch. No metric computed here.
//
// No code is shown on screen (owner 2026-10-21): one "Copy content for LLM" button
// copies the full instructions (endpoint, token, events, server and browser
// variants) for the user to paste into Claude/Cursor or hand to their developer.
// This tracker is one source among others (CRM, payment and calendar connectors):
// the same outcome reported twice is reconciled on our side, so nothing is hidden
// because a connector also covers the step.

// Relative "time since" for the status line. Coarse buckets are enough — we only
// need "is this recent" reassurance, not a precise timestamp.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Live status pill. Renders the liveness fields lead-service DERIVES from received
// events (status is server-owned — no client computation of it). Renders nothing
// until the producer ships those fields (they arrive optional), so the card
// degrades cleanly to just the copy button in the meantime.
function StatusPill({ data }: { data: BrandConversionToken }) {
  const { status, lastEventAt, lastPingAt, eventTypesSeen } = data;
  if (!status) return null;

  const cfg =
    status === "live"
      ? {
          dot: "bg-green-500",
          text: "text-green-700",
          box: "border-green-200 bg-green-50",
          label: "Live",
          sub:
            lastEventAt != null
              ? `Last ${eventTypesSeen?.[0] ?? "conversion"} ${timeAgo(lastEventAt)}`
              : "Receiving conversions",
        }
      : status === "live_waiting"
        ? {
            dot: "bg-green-500",
            text: "text-green-700",
            box: "border-green-200 bg-green-50",
            label: "Tracker live",
            sub:
              lastPingAt != null
                ? `Waiting for your first conversion · last ping ${timeAgo(lastPingAt)}`
                : "Waiting for your first conversion",
          }
        : null;
  // Nothing until the first ping or event: a "not set up" warning reads as a gap
  // when another source (a connector) may already report the same outcomes.
  if (!cfg) return null;

  return (
    <div className={`mt-4 inline-flex items-center gap-2 rounded-lg border ${cfg.box} px-3 py-2`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
      <span className="text-sm text-gray-500">· {cfg.sub}</span>
    </div>
  );
}

/** What conversion tracking is for, stated once for this card and its v2 host. */
export const CONVERSION_TRACKING_BLURB =
  "See which leads we emailed became real customers. Add our tracker to your site once. Each time someone signs up, books a call or pays, we link that person to the lead we emailed. Your results then show the customers and revenue our emails bring you. We also learn which emails sell best and send more of them.";

function llmBrief(ingestUrl: string, token: string): string {
  return `Add conversion tracking to my website for distribute.you.

distribute.you emails leads for me. Each time one of these events happens on my
site, send it to distribute.you so it can match the person back to the lead it
emailed and count the real result.

## Endpoint

POST ${ingestUrl}
Headers:
  x-conversion-token: ${token}
  Content-Type: application/json

The token is a write-only key for this one brand. It can only send events, so it
is safe in browser code.

## Events ("event" field, required)

- signup           a user creates an account
- meeting_booked   a user books a meeting or demo
- form_submission  a user submits a lead or contact form
- sale             a customer completes a sale (add "valueCents", the amount in cents)
- ping             no other fields; send once on page load so distribute.you can
                   confirm the tracker is live before the first real event

## Body

Send every identity field you have. Email matches best; a name is enough.
{
  "event": "signup",
  "email": "the-user@email.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "companyUrl": "https://theircompany.com"
}

A sale:
{ "event": "sale", "email": "the-user@email.com", "valueCents": 4900 }

## Where to wire it

1. Server side, in the success handler of each action (account created, booking
   confirmed, form saved, payment succeeded). Most reliable: ad blockers cannot
   stop it. Example:

curl -X POST ${ingestUrl} \\
  -H "x-conversion-token: ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"signup","email":"customer@email.com","firstName":"Jane","lastName":"Doe"}'

2. Browser only if there is no backend:

<script>
  fetch("${ingestUrl}", {
    method: "POST",
    headers: { "x-conversion-token": "${token}", "Content-Type": "application/json" },
    body: JSON.stringify({ event: "ping" }),
  });
</script>

Then, when the action succeeds:
fetch("${ingestUrl}", {
  method: "POST",
  headers: { "x-conversion-token": "${token}", "Content-Type": "application/json" },
  body: JSON.stringify({ event: "signup", email, firstName, lastName }),
});

## Rules

- Pull the real values from the form, session or payment, never these placeholders.
- Payments or bookings that happen outside the site (invoice, bank transfer, phone)
  can be sent the same way from wherever they are recorded.
- Sending an event that a connected tool (Stripe, calendar, CRM) also reports is
  fine: distribute.you counts it once.`;
}

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return [copied, copy];
}

/** `bare` drops the card's own heading and explanation, for a host that states them beside it. */
export function BrandConversionTrackingCard({ brandId, bare = false }: { brandId: string; bare?: boolean }) {
  const { data, isPending } = useAuthQuery(["brandConversionToken", brandId], () =>
    getBrandConversionToken(brandId),
  );

  const [llmCopied, copyLlm] = useCopy();

  if (isPending) {
    return (
      <div className="p-5">
        <div className="mb-4 h-4 w-56 animate-pulse rounded bg-gray-100" />
        <div className="mb-2 h-3 w-40 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-5 text-sm text-red-600">
        Could not load your conversion tracking. Refresh to try again.
      </div>
    );
  }

  const { token, ingestUrl } = data;

  return (
    <div className="p-5">
      {bare ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm text-gray-500">
            Paste the instructions into Claude or Cursor, or send them to your developer.
          </p>
          <button
            onClick={() => copyLlm(llmBrief(ingestUrl, token))}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {llmCopied ? "Copied!" : "Copy content for LLM"}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-2 flex items-start justify-between gap-4">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900">Conversion tracking</h3>
              <p className="max-w-xl text-sm text-gray-500">{CONVERSION_TRACKING_BLURB}</p>
            </div>
            <button
              onClick={() => copyLlm(llmBrief(ingestUrl, token))}
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              {llmCopied ? "Copied!" : "Copy content for LLM"}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Paste the instructions into Claude or Cursor, or send them to your developer.
          </p>
        </>
      )}

      <StatusPill data={data} />
    </div>
  );
}
