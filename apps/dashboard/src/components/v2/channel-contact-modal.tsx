"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { CHANNEL_REQUEST_MAX_CHARS } from "@/lib/channel-request-email";

/**
 * "Contact us" on a channel we do not run yet. One text area: what they want and the
 * budget they have in mind. Sending it emails staff right away (`/api/channel-request`).
 * Same frame as `V2NewOfferModal`: a `k-popover` portalled to `#v2-portal`, Esc closes it.
 */
export function ChannelContactModal({
  channel,
  mark,
  orgId,
  brandId,
  offerId,
  onClose,
}: {
  channel: { slug: string; name: string };
  mark: React.ReactNode;
  orgId: string;
  brandId: string;
  offerId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");

  const { mutate, isPending, isSuccess, error } = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/channel-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelSlug: channel.slug, channelName: channel.name, message: text, orgId, brandId, offerId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not send your request. Try again.");
      }
    },
    onError: (err) => {
      console.error("[dashboard v2] channel request failed", err);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  const trimmed = message.trim();
  const over = message.length > CHANNEL_REQUEST_MAX_CHARS;
  const submittable = trimmed.length > 0 && !over;

  if (typeof document === "undefined") return null;
  const host = document.getElementById("v2-portal") ?? document.body;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[12vh]" onMouseDown={() => !isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-channel-contact-title"
        className="k-popover flex w-full max-w-[480px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          {mark}
          <span id="v2-channel-contact-title" className="k-label">
            {channel.name}
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={isPending}>
            ×
          </button>
        </div>

        {isSuccess ? (
          <div className="px-4 py-5">
            <p className="k-fg text-[14px] font-medium">Thanks, we got it.</p>
            <p className="k-fg2 mt-1 text-[13px]">We will reply by email.</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={onClose} className="k-btn">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form
            className="px-4 py-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (submittable && !isPending) mutate(trimmed);
            }}
          >
            <label htmlFor="v2-channel-contact-message" className="k-label block">
              What do you have in mind?
            </label>
            <textarea
              id="v2-channel-contact-message"
              autoFocus
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`What you want from ${channel.name}, and the budget you have in mind (say $500 to $2,000 a month).`}
              aria-invalid={over}
              // keel.css is unlayered, so `k-input`'s 28px height beats any Tailwind h-*: size it inline.
              style={{ height: "auto", minHeight: 132 }}
              className={`k-input mt-1.5 block w-full resize-y px-2.5 py-2 leading-[20px] ${over ? "shadow-[inset_0_0_0_1px_var(--data-rose)]" : ""}`}
            />

            {error !== null && (
              <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
                {error instanceof Error ? error.message : "Could not send your request. Try again."}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={isPending} className="k-btn-ghost">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!submittable || isPending}
                className={`k-btn-accent ${isPending ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
              >
                {isPending ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    host,
  );
}
