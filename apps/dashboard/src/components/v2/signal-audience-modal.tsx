"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { ApiError, createSignalAudience, getBrandUserFields } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  SIGNAL_DEFAULT_WINDOW_DAYS,
  SIGNAL_MAX_PAGES,
  SIGNAL_WINDOW_OPTIONS,
  isLinkedInCompanyPage,
} from "@/lib/signal-audience";

/** The brand's own words for who it sells to, the prefill when no audience states one yet. */
function brandTarget(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join("\n").trim();
  return "";
}

/**
 * The refusal sentence. A 400/422 here is the producer's NAMED refusal of the pages
 * (apollo-service's message, relayed verbatim by human-service and the gateway), written
 * for the person who typed them, so it is shown as is. Every other status gets our copy.
 */
export function signalAudienceErrorMessage(err: unknown): string {
  const status = err instanceof ApiError ? err.status : null;
  if ((status === 400 || status === 422) && err instanceof Error && err.message) return err.message;
  if (status === 409) return "An audience with this name already exists. Pick another name.";
  return "We could not create this audience. Try again in a minute.";
}

/**
 * A new LinkedIn signal audience: the people who recently reacted to or commented on
 * 1-3 competitor company pages' posts. Keel's modal anatomy (`k-popover` portalled to
 * `#v2-portal`, Esc closes, a `k-label` header plus ×), same frame as the new offer modal.
 *
 * The URL check here is a hint only; the producer validates the pages and its named
 * refusal is what the form shows. An audience is immutable: other pages are a new one.
 */
export function V2SignalAudienceModal({
  brandId,
  offerId,
  seedPrompt,
  onClose,
  onCreated,
}: {
  brandId: string;
  offerId?: string;
  /** The target description an existing audience of this offer already carries. */
  seedPrompt: string | null;
  onClose: () => void;
  onCreated: (audienceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [pages, setPages] = useState<string[]>([""]);
  const [windowDays, setWindowDays] = useState<number>(SIGNAL_DEFAULT_WINDOW_DAYS);
  const [prompt, setPrompt] = useState<string | null>(seedPrompt);
  const [name, setName] = useState("");

  // No audience to copy from: prefill with what the brand said it sells to.
  const fields = useAuthQuery(["brandUserFields", brandId], () => getBrandUserFields(brandId), {
    enabled: seedPrompt == null,
  });
  useEffect(() => {
    if (prompt != null || !fields.data) return;
    setPrompt(brandTarget(fields.data.fields.targetAudience?.value));
  }, [fields.data, prompt]);

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: () =>
      createSignalAudience({
        brandId,
        ...(offerId ? { offerId } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
        nlPrompt: (prompt ?? "").trim(),
        signal: { type: "linkedin_engagement", windowDays, competitorPages: pages.map((p) => p.trim()).filter(Boolean) },
      }),
    onSuccess: ({ audience }) => {
      queryClient.invalidateQueries({ queryKey: ["audiences", brandId] });
      onCreated(audience.id);
    },
    onError: (err) => {
      console.error("[dashboard v2] createSignalAudience failed", err);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isPending]);

  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  if (!host) return null;

  const filled = pages.map((p) => p.trim()).filter(Boolean);
  const badPage = pages.some((p) => p.trim() && !isLinkedInCompanyPage(p));
  const promptText = (prompt ?? "").trim();
  const submittable = filled.length > 0 && !badPage && promptText.length > 0;
  const edit = (fn: () => void) => {
    fn();
    if (error) reset();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[10vh]" onMouseDown={() => !isPending && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-signal-audience-title"
        className="k-popover flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-signal-audience-title" className="k-label">
            New LinkedIn signal audience
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={isPending}>
            ×
          </button>
        </div>

        <form
          className="k-scroll min-h-0 overflow-y-auto px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (submittable && !isPending) mutate();
          }}
        >
          <p className="k-fg2 text-[13px]">People who recently liked or commented on your competitors&apos; LinkedIn posts.</p>

          <label htmlFor="v2-signal-page-0" className="k-label mt-4 block">
            Competitor LinkedIn pages
          </label>
          <div className="mt-1.5 space-y-2">
            {pages.map((p, i) => {
              const bad = p.trim() !== "" && !isLinkedInCompanyPage(p);
              return (
                <div key={i} className="flex items-center gap-2">
                  <input
                    id={`v2-signal-page-${i}`}
                    autoFocus={i === 0}
                    value={p}
                    onChange={(e) => edit(() => setPages((prev) => prev.map((v, j) => (j === i ? e.target.value : v))))}
                    placeholder="https://www.linkedin.com/company/acme/"
                    aria-invalid={bad}
                    // keel.css is unlayered, so a Tailwind shadow utility loses to `.k-input`.
                    style={bad ? { boxShadow: "inset 0 0 0 1px var(--data-rose)" } : undefined}
                    className="k-input w-full px-2.5"
                  />
                  {pages.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove page ${i + 1}`}
                      onClick={() => edit(() => setPages((prev) => prev.filter((_, j) => j !== i)))}
                      className="k-btn-ghost h-7 w-7 shrink-0 justify-center p-0"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <p className={`text-[12px] leading-[18px] ${badPage ? "text-[var(--data-rose)]" : "k-fg3"}`}>
              {badPage ? "Use a company page link, like linkedin.com/company/acme." : "Up to 3 company pages."}
            </p>
            {pages.length < SIGNAL_MAX_PAGES && (
              <button type="button" onClick={() => edit(() => setPages((prev) => [...prev, ""]))} className="k-btn-ghost h-6 shrink-0 text-[12px]">
                Add a page
              </button>
            )}
          </div>

          <label htmlFor="v2-signal-window" className="k-label mt-4 block">
            Posts from the last
          </label>
          <select
            id="v2-signal-window"
            value={windowDays}
            onChange={(e) => edit(() => setWindowDays(Number(e.target.value)))}
            className="k-input mt-1.5 w-full px-2"
          >
            {SIGNAL_WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>

          <label htmlFor="v2-signal-prompt" className="k-label mt-4 block">
            Who to write to
          </label>
          <textarea
            id="v2-signal-prompt"
            value={prompt ?? ""}
            onChange={(e) => edit(() => setPrompt(e.target.value))}
            rows={4}
            placeholder={prompt == null && fields.isFetching ? "Loading..." : "Heads of sales at B2B software companies"}
            style={{ height: 88 }}
            className="k-input mt-1.5 w-full resize-y px-2.5 py-1.5 leading-5"
          />
          <p className="k-fg3 mt-1.5 text-[12px] leading-[18px]">We only email the people who fit this.</p>

          <label htmlFor="v2-signal-name" className="k-label mt-4 block">
            Name <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="v2-signal-name"
            value={name}
            maxLength={200}
            onChange={(e) => edit(() => setName(e.target.value))}
            placeholder="Named after the pages"
            className="k-input mt-1.5 w-full px-2.5"
          />

          {error !== null && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {signalAudienceErrorMessage(error)}
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
              {isPending ? "Creating..." : "Create audience"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    host,
  );
}
