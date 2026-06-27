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
import { pollOptions } from "@/lib/query-options";
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
    pollOptions,
  );
  const { data: audiencesData } = useAuthQuery<AudiencesResponse>(
    ["audiences", brandId],
    () => listAudiences(brandId!),
    { enabled: brandId !== null, ...pollOptions },
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

  // Off-session auto-reload is impossible for some card countries (e.g. India).
  // Absent => supported (today's behavior); only an explicit false blocks it.
  const autoReloadSupported = account.auto_reload_supported !== false;
  const outOfCredit = parseFloat(account.balance_cents) <= 0;

  const kind = nextReminder({
    hasAutoTopup: account.has_auto_topup,
    autoReloadSupported,
    outOfCredit,
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
      showPaymentRequired({ balance_cents: account.balance_cents, proactive: true, autoReloadSupported });
    } else if (orgId) {
      router.push(`/orgs/${orgId}/brands/${brandId}/audiences`);
    }
    dismiss(kind);
  };

  // For an auto-reload-blocked brand the topup reminder is a one-time recharge,
  // never an "enable auto-topup" ask (which is impossible for their card).
  const copy =
    kind === "topup" && !autoReloadSupported
      ? REMINDER_COPY.topupRecharge
      : REMINDER_COPY[kind];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        aria-label="Close"
        onClick={() => dismiss(kind)}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 gradient-bg opacity-60" />
        <div className="relative p-7">
          <span className="dy-eyebrow mb-4">
            <span className="dy-dot" />
            {kind === "topup" ? "Keep it running" : "One last thing"}
          </span>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
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
          <h2 className="font-display text-xl tracking-tight text-gray-900">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">{copy.body}</p>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              onClick={() => dismiss(kind)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
            >
              Later
            </button>
            <button
              onClick={onPrimary}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {copy.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
