"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  listAudiences,
  type BillingAccount,
  type AudienceWire,
} from "@/lib/api";

type AudiencesResponse = { audiences: AudienceWire[]; total: number };
import { useBillingGuard } from "@/lib/billing-guard";
import { pollOptionsSlower } from "@/lib/query-options";
import { REMINDER_COPY } from "@/lib/onboarding-content";
import {
  nextReminder,
  reminderDismissKey,
  type ReminderKind,
} from "@/lib/onboarding-reminders";

/**
 * State-based reminder modals shown after the welcome tour (or immediately for
 * returning users). One at a time, topup first: a funded wallet and an active
 * audience are the two things outreach cannot run without. Each is dismissable
 * once per session per brand (sessionStorage); it re-appears next session while
 * the blocker is still unresolved, and never once resolved.
 */
export function OnboardingReminders() {
  const params = useParams();
  const brandId = (params?.brandId as string | undefined) ?? null;
  const router = useRouter();
  const orgId = params?.orgId as string | undefined;
  const { showPaymentRequired } = useBillingGuard();

  // Re-render trigger when a dismissal is written to sessionStorage.
  const [dismissTick, setDismissTick] = useState(0);

  const { data: account } = useAuthQuery<BillingAccount>(
    ["billingAccount"],
    () => getBillingAccount(),
    pollOptionsSlower,
  );
  const { data: audiencesData } = useAuthQuery<AudiencesResponse>(
    ["audiences", brandId],
    () => listAudiences(brandId!),
    { enabled: brandId !== null, ...pollOptionsSlower },
  );

  if (!brandId || !account || !audiencesData) return null;

  const activeAudienceCount = audiencesData.audiences.filter(
    (a) => a.status === "active",
  ).length;

  const topupDismissed =
    typeof window !== "undefined" &&
    sessionStorage.getItem(reminderDismissKey(brandId, "topup")) !== null;
  const audienceDismissed =
    typeof window !== "undefined" &&
    sessionStorage.getItem(reminderDismissKey(brandId, "audience")) !== null;

  // `dismissTick` is read so the memoless component recomputes after a dismissal.
  void dismissTick;

  const kind = nextReminder({
    hasAutoTopup: account.has_auto_topup,
    activeAudienceCount,
    topupDismissed,
    audienceDismissed,
  });

  if (!kind) return null;

  const dismiss = (k: ReminderKind) => {
    sessionStorage.setItem(reminderDismissKey(brandId, k), "1");
    setDismissTick((t) => t + 1);
  };

  const onPrimary = () => {
    if (kind === "topup") {
      showPaymentRequired({ balance_cents: account.balance_cents, proactive: true });
    } else if (orgId) {
      router.push(`/orgs/${orgId}/brands/${brandId}/audiences`);
    }
    dismiss(kind);
  };

  const copy = REMINDER_COPY[kind];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={
                kind === "topup"
                  ? "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  : "M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z"
              }
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{copy.title}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{copy.body}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => dismiss(kind)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Later
          </button>
          <button
            onClick={onPrimary}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
