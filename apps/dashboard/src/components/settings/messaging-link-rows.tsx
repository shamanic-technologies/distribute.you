"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { listMatrixLinks, startMatrixLink, unlinkMatrixLink, type MatrixLink } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { CompanyLogo } from "@/components/company-logo";
import { linkErrorMessage } from "@/lib/integration-write";

/** While a code is on screen it refreshes on the vendor's schedule, so the read polls fast. */
const WAITING_POLL_MS = 3_000;

const CHANNEL: Record<string, { name: string; domain: string; blurb: string }> = {
  whatsapp: { name: "WhatsApp", domain: "whatsapp.com", blurb: "Read your WhatsApp chats with each person, in their thread." },
  telegram: { name: "Telegram", domain: "telegram.org", blurb: "Read your Telegram chats with each person, in their thread." },
  discord: { name: "Discord", domain: "discord.com", blurb: "Read your Discord messages with each person, in their thread." },
};

/**
 * Messaging apps, linked by the customer themselves: crm-service creates this
 * brand's own bridge account and runs the app's login, so the row only shows the
 * QR to scan (or the pairing code for a phone number) and polls until the app says
 * linked. Nothing is ever sent on the linked account. A channel whose bridge is not
 * running reads "Not available yet" (crm-service's reason on hover) with no button.
 */
export function MessagingLinkRows({ brandId }: { brandId: string }) {
  const q = useAuthQuery(["matrixLinks", brandId], () => listMatrixLinks(brandId), {
    refetchInterval: (query: { state: { data?: { links: MatrixLink[] } } }) =>
      query.state.data?.links.some((l) => l.status === "waiting") ? WAITING_POLL_MS : false,
  });
  if (q.isError && !q.data) {
    return <p className="p-5 text-sm text-gray-600">We could not read your messaging apps just now. Retrying.</p>;
  }
  if (!q.data) {
    return (
      <div className="p-5">
        <span className="block h-10 w-full animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }
  return (
    <>
      {q.data.links.map((link) => (
        <MessagingRow key={link.channel} brandId={brandId} link={link} />
      ))}
    </>
  );
}

function MessagingRow({ brandId, link }: { brandId: string; link: MatrixLink }) {
  const queryClient = useQueryClient();
  const meta = CHANNEL[link.channel] ?? { name: link.channel, domain: `${link.channel}.com`, blurb: "" };
  const [phone, setPhone] = useState("");
  const [usePhone, setUsePhone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const reread = () => queryClient.refetchQueries({ queryKey: ["matrixLinks", brandId] });

  const start = useMutation({
    mutationFn: (method: "qr" | "phone") => startMatrixLink(brandId, link.channel, method, method === "phone" ? phone.trim() : undefined),
    onSuccess: async () => {
      setError(null);
      await reread();
    },
    onError: (err: Error) => {
      console.error("[integrations] starting the link failed", link.channel, err);
      setError(linkErrorMessage(err));
    },
  });

  const unlink = useMutation({
    mutationFn: () => unlinkMatrixLink(brandId, link.channel),
    onSuccess: async () => {
      setConfirming(false);
      setError(null);
      await reread();
    },
    onError: (err: Error) => {
      console.error("[integrations] unlinking failed", link.channel, err);
      setError("Could not unlink. Try again.");
    },
  });

  const waiting = link.status === "waiting";
  const linked = link.status === "linked";
  const busy = start.isPending || unlink.isPending;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-1">
          <CompanyLogo domain={meta.domain} name={meta.name} size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900">{meta.name}</span>
            <LinkPill link={link} />
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{meta.blurb}</p>

          {linked && link.account ? (
            <p className="mt-2 text-sm text-gray-700">
              Linked to {link.account.name ? `${link.account.name} (${link.account.id})` : link.account.id}
            </p>
          ) : null}
          {linked && link.bridgeState?.state && link.bridgeState.state !== "CONNECTED" ? (
            <p className="mt-1 text-sm text-amber-700">{link.bridgeState.reason ?? "The app disconnected this device. Unlink and link again."}</p>
          ) : null}
          {link.status === "failed" && link.error ? <p className="mt-2 text-sm text-amber-700">{link.error.message}</p> : null}

          {waiting ? (
            <div className="mt-3 flex flex-wrap items-start gap-4">
              {link.qr ? (
                <img src={link.qr.imageDataUrl} alt={`QR code to link ${meta.name}`} width={176} height={176} className="rounded-lg border border-gray-200 bg-white p-2" />
              ) : null}
              {link.pairingCode ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-2xl tracking-widest text-gray-900">{link.pairingCode}</p>
              ) : null}
              <p className="max-w-xs text-sm text-gray-600">
                {link.instructions ??
                  (link.qr
                    ? `On your phone, open ${meta.name}, then Linked devices, then Link a device, and scan this code.`
                    : `On your phone, open ${meta.name}, then Linked devices, then Link with phone number, and type this code.`)}
              </p>
            </div>
          ) : null}

          {link.available && !linked && !waiting && usePhone ? (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start.mutate("phone");
              }}
            >
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33612345678"
                aria-label="Your phone number, in international format"
                className="w-56 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300/40"
              />
              <button type="submit" disabled={!phone.trim() || busy} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40">
                {start.isPending ? "Asking for a code..." : "Get a code"}
              </button>
            </form>
          ) : null}

          {confirming ? (
            <p className="mt-2 text-sm text-gray-600">This logs us out of your {meta.name}, stops reading it and removes what we mirrored. Nothing on your phone changes.</p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!link.available ? null : confirming ? (
            <>
              <button type="button" onClick={() => unlink.mutate()} disabled={busy} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
                {unlink.isPending ? "Unlinking..." : "Yes, unlink"}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                Keep it
              </button>
            </>
          ) : linked || waiting ? (
            <button type="button" onClick={() => setConfirming(true)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              {linked ? "Unlink" : "Cancel"}
            </button>
          ) : (
            <>
              {link.methods.includes("phone") ? (
                <button type="button" onClick={() => setUsePhone((v) => !v)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  {usePhone ? "Use a QR code" : "Use a phone number"}
                </button>
              ) : null}
              {!usePhone && link.methods.includes("qr") ? (
                <button type="button" onClick={() => start.mutate("qr")} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                  {start.isPending ? "Getting a code..." : link.status === "failed" ? "Try again" : "Link"}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkPill({ link }: { link: MatrixLink }) {
  // crm-service's own sentence says why, on hover; the pill is the short form.
  const cfg = !link.available
    ? { box: "border-gray-200 bg-gray-50 text-gray-600", label: "Not available yet", title: link.unavailableReason ?? undefined }
    : link.status === "linked"
      ? link.bridgeState?.state && link.bridgeState.state !== "CONNECTED"
        ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: "Needs attention" }
        : { box: "border-green-200 bg-green-50 text-green-700", label: "Linked" }
      : link.status === "waiting"
        ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: "Waiting for your phone" }
        : link.status === "failed"
          ? { box: "border-amber-200 bg-amber-50 text-amber-700", label: "Did not link" }
          : { box: "border-gray-200 bg-gray-50 text-gray-600", label: "Not linked" };
  return (
    <span title={"title" in cfg ? cfg.title : undefined} className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.box}`}>
      {cfg.label}
    </span>
  );
}
