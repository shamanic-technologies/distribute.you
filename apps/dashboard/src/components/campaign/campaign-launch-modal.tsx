"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { keepPreviousData } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { listCampaignEvents, getCampaign, listCampaignLeads } from "@/lib/api";
import {
  LAUNCH_STEPS,
  launchStepFromEvents,
  hasContactedLead,
  domainFromUrls,
} from "@/lib/campaign-launch-progress";

/**
 * Non-closable launch modal. Right after an outreach launches the first email
 * takes minutes to arrive (find leads → write email → set up sending); a silent
 * screen reads as "nothing happened". This overlays the whole dashboard and
 * walks the user through four reassurance steps — each advancing on a REAL
 * backend signal, not a timer — then closes the instant the first lead is
 * contacted.
 *
 * Self-contained: it takes ONLY the new subscription's `campaignId` (read from
 * the brand-overview `?launched=` marker) and fetches the campaign (for status +
 * brand URLs) and leads itself — no campaign context needed, so it mounts on the
 * brand Overview.
 *
 * Gate (option B): only an ONGOING, not-yet-contacted run is blocked, and only
 * until the user takes the 5-minute escape. An established run (>=1 contacted
 * lead) or a stopped run never sees the modal, so a finished or paused run can't
 * trap anyone. The escape (shown only after 5 min without a first email)
 * persist-dismisses this run for the session so a stalled launch is escapable
 * exactly once and doesn't re-block on revisit.
 */

// Mirror CampaignActivity's window + query key so React Query dedupes a single
// events poll across both consumers (one network call feeds both).
const EVENTS_WINDOW = 150;

// Surface the escape only after the normal launch window has clearly passed.
const ESCAPE_AFTER_MS = 5 * 60 * 1000;

function dismissKey(campaignId: string): string {
  return `campaign-launch-dismissed:${campaignId}`;
}

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function StepRow({ label, done, current }: { label: string; done: boolean; current: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
        {done ? (
          <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : current ? (
          <Spinner className="h-4 w-4 text-gray-700" />
        ) : (
          <span className="h-4 w-4 rounded-full border-2 border-gray-200" />
        )}
      </span>
      <span
        className={
          done
            ? "text-sm font-medium text-green-600"
            : current
              ? "text-sm font-medium text-gray-900"
              : "text-sm text-gray-300"
        }
      >
        {label}
      </span>
    </li>
  );
}

export function CampaignLaunchModal({
  campaignId,
}: {
  campaignId: string;
}) {
  // Fetch the just-launched subscription for its status + brand URLs (the
  // brand-overview ?launched= marker pre-seeds the ["campaign", id] cache, so
  // this paints instantly). Reuse the campaign-detail query keys so any other
  // observer dedupes.
  const { data: campaignData } = useAuthQuery(
    ["campaign", campaignId],
    () => getCampaign(campaignId),
    pollOptions,
  );
  const campaignStatus = campaignData?.campaign.status ?? "";
  const brandUrls = campaignData?.campaign.brandUrls ?? [];

  // Leads for this run — drives the "contacted" close condition.
  const { data: leadsData, isPending: leadsLoading } = useAuthQuery(
    ["campaignLeads", campaignId],
    () => listCampaignLeads(campaignId),
    pollOptions,
  );
  const leads = leadsData?.leads ?? [];

  // Same key as CampaignActivity → shared cache, one poll. CampaignActivity's
  // observer is flag-gated (disabled for non-staff); this one stays enabled so
  // the events still fetch for every user.
  const { data, isPending } = useAuthQuery(
    ["campaignActivity", campaignId],
    () => listCampaignEvents(campaignId, { limit: EVENTS_WINDOW }),
    { ...pollOptions, placeholderData: keepPreviousData },
  );

  // Monotonic latch — events scroll out of the 150-window, so a step once
  // reached must not regress on a later poll. (Reveal-layer analog of the
  // status latch / keepPreviousData.)
  const reachedRef = useRef(0);
  const stepNow = launchStepFromEvents(data?.events ?? []);
  if (stepNow > reachedRef.current) reachedRef.current = stepNow;
  const reached = reachedRef.current;

  const contacted = hasContactedLead(leads);

  // 5-minute escape hatch, persist-dismissed per campaign for the session.
  const [escaped, setEscaped] = useState(false);
  const [escapeAvailable, setEscapeAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.sessionStorage.getItem(dismissKey(campaignId))) {
      setEscaped(true);
    }
    setEscapeAvailable(false);
    const t = setTimeout(() => setEscapeAvailable(true), ESCAPE_AFTER_MS);
    return () => clearTimeout(t);
  }, [campaignId]);

  const dismiss = () => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(dismissKey(campaignId), "1");
    setEscaped(true);
  };

  // Wait for both queries to resolve before deciding — otherwise an established
  // (already-contacted) campaign would flash the modal open for the cold fetch
  // then close once leads land.
  const open =
    campaignStatus === "ongoing" &&
    !leadsLoading &&
    !isPending &&
    !contacted &&
    !escaped;

  // Lock body scroll while the modal blocks the dashboard.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const domain = domainFromUrls(brandUrls);

  // No close button, no backdrop onClick, no Escape handler — the user is meant
  // to wait. The 5-minute escape link below is the only exit.
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <Image src="/logo-head.jpg" alt="distribute.you" width={48} height={48} className="rounded-xl" />
        </div>
        <h2 className="mb-8 text-center font-display text-xl font-bold text-gray-900">
          Writing your first emails&hellip;
        </h2>
        <ol className="space-y-4">
          {LAUNCH_STEPS.map((step, i) => {
            const label =
              step.key === "reading"
                ? domain
                  ? `Reading ${domain}`
                  : "Reading your website"
                : step.label;
            return <StepRow key={step.key} label={label} done={i < reached} current={i === reached} />;
          })}
        </ol>
        {escapeAvailable && (
          <button
            type="button"
            onClick={dismiss}
            className="mt-8 block w-full text-center text-xs text-gray-400 transition hover:text-gray-600"
          >
            Taking longer than expected — continue to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
