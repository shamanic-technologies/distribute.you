"use client";

import { useState } from "react";
import { getBrandConversionToken, type BrandConversionToken } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";

// Per-brand conversion tracking. The client drops one of the snippets below on
// their own site; when a lead we emailed signs up, books a meeting, or submits a
// form, the event reaches us and lead-service attributes it back to that lead.
// The token is a publishable write-key (it can only POST events for this one
// brand), so it is safe to show in full inside a snippet and to embed in a
// browser pixel. Read-only display of server-owned snippets; no metric computed.
//
// Every case is laid out linearly (no toggles): each event ships both a
// server-side curl and a browser pixel, with all identity fields pre-filled.
// The "Copy for LLM" button copies a plain-language brief a user can paste into
// Claude/Cursor to have it wired into their own site.

type EventType = "signup" | "meeting_booked" | "form_submission";

const EVENTS: { type: EventType; label: string; when: string }[] = [
  { type: "signup", label: "Signup", when: "a user creates an account" },
  { type: "meeting_booked", label: "Meeting booked", when: "a user books a meeting or demo" },
  { type: "form_submission", label: "Form submission", when: "a user submits a lead or contact form" },
];

function serverSnippet(ingestUrl: string, token: string, event: EventType): string {
  return `curl -X POST ${ingestUrl} \\
  -H "x-conversion-token: ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"${event}","email":"customer@email.com","firstName":"Jane","lastName":"Doe","companyUrl":"https://theircompany.com"}'`;
}

function pixelSnippet(ingestUrl: string, token: string, event: EventType): string {
  return `<script>
  // Fires on page load so we can confirm your tracker is live —
  // before your first conversion even lands.
  fetch("${ingestUrl}", {
    method: "POST",
    headers: { "x-conversion-token": "${token}", "Content-Type": "application/json" },
    body: JSON.stringify({ event: "ping" }),
  });

  // Fire when the ${event} actually happens (pull real values from your form).
  fetch("${ingestUrl}", {
    method: "POST",
    headers: {
      "x-conversion-token": "${token}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: "${event}",
      email: "customer@email.com",
      firstName: "Jane",
      lastName: "Doe",
      companyUrl: "https://theircompany.com",
    }),
  });
</script>`;
}

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
// degrades cleanly to just the snippets in the meantime.
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
            dot: "bg-amber-500",
            text: "text-amber-700",
            box: "border-amber-200 bg-amber-50",
            label: "Tracker live",
            sub:
              lastPingAt != null
                ? `Waiting for your first conversion · last ping ${timeAgo(lastPingAt)}`
                : "Waiting for your first conversion",
          }
        : {
            dot: "bg-gray-400",
            text: "text-gray-600",
            box: "border-gray-200 bg-gray-50",
            label: "Not set up yet",
            sub: "Add one of the snippets below to your site",
          };

  return (
    <div className={`mb-5 inline-flex items-center gap-2 rounded-lg border ${cfg.box} px-3 py-2`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
      <span className="text-sm text-gray-500">· {cfg.sub}</span>
    </div>
  );
}

function llmBrief(ingestUrl: string, token: string): string {
  return `Add conversion tracking to my website for distribute.you.

Endpoint: POST ${ingestUrl}
Headers:  x-conversion-token: ${token}
          Content-Type: application/json

Fire one event when it happens on my site:
- signup          when a user creates an account
- meeting_booked  when a user books a meeting or demo
- form_submission when a user submits a lead or contact form

Body is JSON. "event" is required; send whatever identity fields I have.
Email matches best.
{
  "event": "signup",
  "email": "the-user@email.com",
  "firstName": "Jane",
  "lastName": "Doe",
  "companyUrl": "https://theircompany.com"
}

Also fire {"event":"ping"} (no other fields) once on page load, so distribute
can confirm the tracker is live before the first real conversion.

Wire it server-side on the success handler where possible (most reliable).
Fall back to a browser fetch only if there is no backend. Pull the real
values from the form or session, not these placeholders.`;
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

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, copy] = useCopy();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <button
          onClick={() => copy(code)}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800">
        <code className="font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

export function BrandConversionTrackingCard({ brandId }: { brandId: string }) {
  const { data, isPending } = useAuthQuery(["brandConversionToken", brandId], () =>
    getBrandConversionToken(brandId),
  );

  const [llmCopied, copyLlm] = useCopy();

  if (isPending) {
    return (
      <div className="p-5">
        <div className="mb-4 h-4 w-56 animate-pulse rounded bg-gray-100" />
        <div className="mb-2 h-3 w-40 animate-pulse rounded bg-gray-100" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-gray-100" />
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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Conversion tracking</h3>
          <p className="max-w-xl text-sm text-gray-500">
            Tell us when someone signs up, books a meeting, or submits a form on your site. We
            match each event back to the lead we emailed for you, so your outcome numbers reflect
            real results. Send whatever you have about the person. Email matches best, but a name
            is enough.
          </p>
        </div>
        <button
          onClick={() => copyLlm(llmBrief(ingestUrl, token))}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          {llmCopied ? "Copied!" : "Copy for LLM"}
        </button>
      </div>
      <p className="mb-5 text-xs text-gray-400">
        Not a coder? Paste the LLM brief into Claude, Cursor, or your dev and it wires the tracking
        into your site.
      </p>

      <StatusPill data={data} />

      <div className="space-y-6">
        {EVENTS.map(({ type, label, when }) => (
          <div key={type}>
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-900">{label}</span>
              <span className="ml-2 text-xs text-gray-400">Fire when {when}.</span>
            </div>
            <div className="space-y-4">
              <CopyBlock
                label="Server side (recommended, most reliable)"
                code={serverSnippet(ingestUrl, token, type)}
              />
              <CopyBlock
                label="Browser pixel (if you have no backend)"
                code={pixelSnippet(ingestUrl, token, type)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
