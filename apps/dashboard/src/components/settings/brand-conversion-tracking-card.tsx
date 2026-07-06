"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  getBrandConversionToken,
  rotateBrandConversionToken,
  type BrandConversionToken,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

// Per-brand conversion tracking. The client drops one of the snippets below on
// their own site; when a lead we emailed signs up or books a meeting, the event
// reaches us and lead-service attributes it back to that lead. The token is a
// publishable write-key (it can only POST events for this one brand), so it is
// safe to show in full and to embed in a browser pixel. Read-only display of a
// server-owned token + two copy-ready snippets; no metric is computed here.

type EventType = "signup" | "meeting_booked";

const EVENT_LABELS: Record<EventType, string> = {
  signup: "Signup",
  meeting_booked: "Meeting Booked",
};

function serverSnippet(ingestUrl: string, token: string, event: EventType): string {
  return `curl -X POST ${ingestUrl} \\
  -H "x-conversion-token: ${token}" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"${event}","email":"customer@email.com","firstName":"Jane","lastName":"Doe","companyUrl":"https://theircompany.com"}'`;
}

function pixelSnippet(ingestUrl: string, token: string, event: EventType): string {
  return `<script>
  fetch("${ingestUrl}", {
    method: "POST",
    headers: {
      "x-conversion-token": "${token}",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event: "${event}",
      email: "customer@email.com", // fill these from your signup form
      firstName: "",
      lastName: "",
      companyUrl: "",
    }),
  });
</script>`;
}

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <button
          onClick={copy}
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
  const queryClient = useQueryClient();
  const { data, isPending } = useAuthQuery(["brandConversionToken", brandId], () =>
    getBrandConversionToken(brandId),
  );

  const [event, setEvent] = useState<EventType>("signup");

  const { mutate: rotate, isPending: rotating } = useMutation({
    mutationFn: () => rotateBrandConversionToken(brandId),
    onSuccess: (res) => {
      queryClient.setQueryData<BrandConversionToken>(["brandConversionToken", brandId], res);
    },
  });

  const [copiedToken, setCopiedToken] = useState(false);
  function copyToken(token: string) {
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    });
  }

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
        Could not load your conversion tracking token. Refresh to try again.
      </div>
    );
  }

  const { token, ingestUrl } = data;

  return (
    <div className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Conversion tracking</h3>
      <p className="mb-5 text-sm text-gray-500">
        Tell us when someone signs up or books a meeting on your site. We match each event back
        to the lead we emailed for you, so your Signups and Meetings numbers reflect real
        outcomes. Send whatever you have about the person. Email matches best, but a name is
        enough.
      </p>

      {/* Ingest token (publishable write-key) */}
      <div className="mb-5 max-w-xl">
        <label className="mb-1 block text-xs text-gray-500">Your tracking token</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800">
            {token}
          </code>
          <button
            onClick={() => copyToken(token)}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            {copiedToken ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => rotate()}
            disabled={rotating}
            className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            {rotating ? "Rotating..." : "Rotate"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          Safe to embed in your site. It can only send events for this brand. Rotate it if it
          leaks somewhere it should not.
        </p>
      </div>

      {/* Event picker */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs text-gray-500">Event to fire</label>
        <div className="inline-flex rounded-lg border border-brand-200 bg-brand-50 p-0.5">
          {(Object.keys(EVENT_LABELS) as EventType[]).map((e) => (
            <button
              key={e}
              onClick={() => setEvent(e)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                event === e
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-brand-600 hover:text-brand-700"
              }`}
            >
              {EVENT_LABELS[e]}
            </button>
          ))}
        </div>
      </div>

      {/* Snippets */}
      <div className="space-y-4">
        <CopyBlock
          label="Server side (recommended, most reliable)"
          code={serverSnippet(ingestUrl, token, event)}
        />
        <CopyBlock
          label="Browser pixel (if you have no backend)"
          code={pixelSnippet(ingestUrl, token, event)}
        />
      </div>
    </div>
  );
}
