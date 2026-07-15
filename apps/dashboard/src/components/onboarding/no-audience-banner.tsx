"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listAudiences, type AudienceWire } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import {
  NO_AUDIENCE_BANNER_COPY,
  AUDIENCE_EXHAUSTED_BANNER_COPY,
  AUDIENCE_LOW_REMAINING_BANNER_COPY,
} from "@/lib/onboarding-content";
import {
  audienceNudge,
  shouldShowNoAudienceBanner,
} from "@/lib/onboarding-reminders";

type AudiencesResponse = { audiences: AudienceWire[]; total: number };

/**
 * Persistent red banner when the brand in view has no usable audience: none
 * active, or every active one is contacted out. Outreach cannot run, so this is
 * a hard-blocker (mirrors the urgent credit runway banner). Unlike the reminder
 * modal it is NOT dismissable, it stays until the user extends or adds an
 * audience. Mounted in the dashboard layout alongside CreditAlerts; renders
 * nothing off a brand route.
 */
export function NoAudienceBanner() {
  const params = useParams();
  const orgId = params?.orgId as string | undefined;
  const brandId = (params?.brandId as string | undefined) ?? null;

  const { data } = useAuthQuery<AudiencesResponse>(
    ["audiences", brandId],
    () => listAudiences(brandId!),
    { enabled: brandId !== null, ...pollOptions },
  );

  const nudge = audienceNudge(data?.audiences ?? []);

  const show = shouldShowNoAudienceBanner({
    brandId,
    audienceNudge: nudge,
    loaded: data !== undefined,
  });

  if (!show || !orgId || !brandId) return null;

  const copy =
    nudge.tier === "exhausted"
      ? AUDIENCE_EXHAUSTED_BANNER_COPY
      : nudge.tier === "low-remaining"
        ? AUDIENCE_LOW_REMAINING_BANNER_COPY
        : NO_AUDIENCE_BANNER_COPY;
  const message = copy.message.replace(
    "{pct}",
    String(nudge.remainingPct ?? 0),
  );

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-600 px-4 py-2 text-sm text-white"
      role="alert"
    >
      <span className="flex items-center gap-2 font-medium">
        <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        {message}
      </span>
      <Link
        href={`/orgs/${orgId}/brands/${brandId}/audiences`}
        className="rounded-full bg-white/15 px-3 py-0.5 font-semibold ring-1 ring-white/25 transition hover:bg-white/25"
      >
        {copy.cta} →
      </Link>
    </div>
  );
}
