"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrganizationList, useOrganization, useSession } from "@clerk/nextjs";
import {
  ArrowTopRightOnSquareIcon,
  ArrowTrendingUpIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ClockIcon,
  CurrencyDollarIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import posthog from "posthog-js";
import { extractDomain } from "@/lib/extract-domain";
import { upsertBrand, extractBrandFields, SALES_PROFILE_FIELDS } from "@/lib/api";

type AccountType = "agency" | "company";
type Step = "booking-intro" | "type-selection" | "url-input";

const ONBOARDING_CALL_URL = "https://calendar.app.google/nVBre64wcCoUFMvN6";

// Value prop mirrors the landing pricing block ("Pay per outcome, like Google
// Ads." → ~$15/signup · ~$90/meeting · ~$120/sale · best ROI on the market) so
// the onboarding screen sells the same outcome economics as distribute.you.
const onboardingBenefits = [
  {
    title: "Pay per outcome",
    description: "~$15 / signup · ~$90 / meeting · ~$120 / sale — varies by industry",
    icon: CurrencyDollarIcon,
    iconClassName: "bg-emerald-50 text-emerald-600",
  },
  {
    title: "Best ROI on the market",
    description: "We find leads, reach out, and turn them into sales",
    icon: ArrowTrendingUpIcon,
    iconClassName: "bg-blue-50 text-blue-600",
  },
  {
    title: "30 minutes",
    description: "Quick setup with an expert",
    icon: ClockIcon,
    iconClassName: "bg-amber-50 text-amber-600",
  },
];

export function DefaultOnboarding() {
  const { createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const { organization } = useOrganization();
  const { session } = useSession();
  // Orgs the user can return to instead of creating a new one. Exclude the active
  // org: a fresh signup auto-creates a brand-less org that is the one the first-run
  // gate bounces back to onboarding, so it is never a "go back" target.
  const otherOrgs = (userMemberships?.data ?? []).filter(
    (m) => m.organization.id !== organization?.id,
  );
  const searchParams = useSearchParams();
  // The "New organization" dropdown entry passes ?new=1 to force a brand-new org
  // even when a populated org is already active. A fresh signup arrives here with
  // no param and an auto-created (brand-less) active org → that org is reused.
  const forceNew = searchParams.get("new") === "1";
  // Website carried from the landing pricing CTA (sign-up ?url= → here). When
  // present, prefill the brand website + name (domain) and land straight on the
  // url step — booking + type are skipped for this fast path (type defaults to
  // "company"; the user can still go Back to change it).
  const prefillUrl = (searchParams.get("url") ?? "").trim();
  const [step, setStep] = useState<Step>(prefillUrl ? "url-input" : "booking-intro");
  const [accountType, setAccountType] = useState<AccountType | null>(prefillUrl ? "company" : null);
  const [url, setUrl] = useState(prefillUrl);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const domain = extractDomain(url);
  // Set when the user clicks "Pick a time" (opens the booking calendar in a new
  // tab). On returning to this tab we advance them past the booking step so the
  // flow moves forward once they've gone to book — see the visibility effect.
  const bookingClickedRef = useRef(false);

  useEffect(() => {
    posthog.capture("onboarding_step_viewed", { step });
  }, [step]);

  // Auto-advance off the booking step when the user comes back from booking a
  // meeting. The "Pick a time" link opens the calendar in a new tab → this tab
  // goes hidden; on re-show, if they'd clicked book and are still on the booking
  // step, move them to type-selection. Re-registers per step so `step` is fresh.
  useEffect(() => {
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        bookingClickedRef.current &&
        step === "booking-intro"
      ) {
        bookingClickedRef.current = false;
        posthog.capture("onboarding_advance_after_booking");
        setStep("type-selection");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [step]);

  const handleTypeSelect = (type: AccountType) => {
    posthog.capture("onboarding_account_type_selected", { account_type: type });
    setAccountType(type);
    setStep("url-input");
  };

  const handleSubmit = async () => {
    if (!domain || !accountType) return;
    setSubmitting(true);
    setError(null);
    posthog.capture("onboarding_workspace_create_started", {
      account_type: accountType,
      domain,
    });
    try {
      const brandUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      // Reuse the active org (signup auto-creates one) unless ?new=1 forces a
      // brand-new org. The org now exists before onboarding runs, so creating a
      // second one would orphan the auto-created org with no brand.
      const reuseOrg = !forceNew && !!organization?.id;
      let targetOrgId: string;
      if (reuseOrg) {
        targetOrgId = organization.id;
      } else {
        if (!createOrganization || !setActive) {
          throw new Error("Organization setup is not ready yet. Please try again.");
        }
        const org = await createOrganization({ name: domain });
        await setActive({ organization: org.id });
        targetOrgId = org.id;
      }
      posthog.capture("onboarding_workspace_create_completed", {
        account_type: accountType,
        domain,
        org_id: targetOrgId,
        reused_org: reuseOrg,
      });
      // No billing step at onboarding: card + auto-topup are configured later, on
      // first campaign launch (billing-guard modal). Create the brand inline so the
      // $2 welcome credit is never tripped by an auto-topup threshold the brand-new
      // balance already sits below, then land straight on the brand.
      posthog.capture("brand_create_started", { source: "onboarding" });
      const { brandId: newBrandId } = await upsertBrand(brandUrl);
      // Mark onboarding complete (edge-gate signal — see proxy.ts / DIS-111).
      // The org now has a brand → it's a usable workspace. Idempotent server-side.
      await fetch("/api/onboarding/complete", { method: "POST" }).catch((e) =>
        console.error("[dashboard] failed to mark onboarding complete:", e)
      );
      // Re-mint the session token so the fresh `orgMeta.onboardingComplete` claim
      // is in the cookie the edge gate reads — otherwise the stale JWT loops the
      // next navigation back to /onboarding (DIS-111).
      await session?.getToken({ skipCache: true }).catch(() => {});
      extractBrandFields([newBrandId], SALES_PROFILE_FIELDS).catch(() => {});
      posthog.capture("brand_create_completed", {
        brand_id: newBrandId,
        source: "onboarding",
      });
      window.location.href = `/orgs/${targetOrgId}/brands/${newBrandId}`;
    } catch (err) {
      posthog.capture("onboarding_workspace_create_failed", {
        account_type: accountType,
        domain,
      });
      setError(err instanceof Error ? err.message : "Registration failed");
      setSubmitting(false);
    }
  };


  const handleReturnToOrg = async (orgId: string) => {
    posthog.capture("onboarding_return_to_existing_org", { org_id: orgId });
    // Mirror the breadcrumb org switcher: AWAIT setActive before navigating so the
    // Clerk session (and its org claim) has rotated before the URL drives the
    // first-run gate — navigating early carries the old org in the lag window (DIS-143).
    if (setActive) {
      await setActive({ organization: orgId });
    }
    window.location.href = `/orgs/${orgId}`;
  };

  // Step 1: Onboarding call booking
  if (step === "booking-intro") {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/60">
        <div className="border-b border-gray-100 px-7 py-7 md:px-10">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-950 text-white">
              <CalendarDaysIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-gray-950">
                Book your onboarding call
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                30 minutes with Kevin Lourd
              </p>
            </div>
          </div>
        </div>

        <div className="px-7 py-8 md:px-10">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 rounded-xl bg-gray-50 p-5">
              <div className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-950">
                    Free strategy session
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    A 30-minute call to set you up for success with Distribute.
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {onboardingBenefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <div key={benefit.title} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${benefit.iconClassName}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-950">{benefit.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{benefit.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mx-auto mt-7 max-w-sm text-center text-sm leading-6 text-gray-400">
            Brands who complete an onboarding call consistently outperform those who don&apos;t.
          </p>
        </div>

        <div className="border-t border-gray-100 px-7 py-7 md:px-10">
          <a
            href={ONBOARDING_CALL_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              bookingClickedRef.current = true;
              posthog.capture("onboarding_call_booking_clicked", {
                booking_url: ONBOARDING_CALL_URL,
              });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gray-950 px-6 py-4 text-base font-semibold text-white transition hover:bg-gray-800"
          >
            Pick a time
            <ArrowTopRightOnSquareIcon className="h-5 w-5" />
          </a>
          <button
            onClick={() => {
              posthog.capture("onboarding_call_skipped");
              setStep("type-selection");
            }}
            className="mt-5 w-full text-center text-sm font-semibold text-gray-400 transition hover:text-gray-600"
          >
            Maybe later
          </button>

          {otherOrgs.length > 0 && (
            <div className="mt-7 border-t border-gray-100 pt-6">
              <p className="mb-3 text-center text-sm font-semibold text-gray-500">
                Already have a workspace?
              </p>
              <div className="space-y-2">
                {otherOrgs.map((m) => (
                  <button
                    key={m.organization.id}
                    onClick={() => handleReturnToOrg(m.organization.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-brand-400 hover:shadow-sm"
                  >
                    {m.organization.hasImage ? (
                      <img
                        src={m.organization.imageUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-950 text-sm font-semibold text-white">
                        {m.organization.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 truncate text-sm font-medium text-gray-900">
                      {m.organization.name}
                    </span>
                    <span className="text-sm font-semibold text-brand-600">
                      Go &rarr;
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Step 2: Type Selection
  if (step === "type-selection") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
        <button
          onClick={() => setStep("booking-intro")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Back
        </button>
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
          How will you use Distribute?
        </h2>
        <p className="text-gray-500 mb-8">
          This helps us set up your workspace correctly.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleTypeSelect("agency")}
            className="text-left bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-brand-400 hover:shadow-md transition group"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition">
              <BuildingOffice2Icon className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Agency</h3>
            <p className="text-sm text-gray-500">
              Manage distribution for multiple client brands from one dashboard
            </p>
          </button>
          <button
            onClick={() => handleTypeSelect("company")}
            className="text-left bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-brand-400 hover:shadow-md transition group"
          >
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-teal-200 transition">
              <BriefcaseIcon className="h-6 w-6 text-teal-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Company</h3>
            <p className="text-sm text-gray-500">
              Automate distribution for your own brand
            </p>
          </button>
        </div>
      </div>
    );
  }

  // Step 3: URL Input — creates org + brand, redirects to brand page
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
      <button
        onClick={() => setStep("type-selection")}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Back
      </button>
      <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
        {accountType === "agency" ? "What's your agency website?" : "What's your company website?"}
      </h2>
      <p className="text-gray-500 mb-6">
        We&apos;ll use this to set up your workspace and create your first brand.
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}
      <div className="space-y-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="e.g. acme.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && domain) handleSubmit();
          }}
        />
        {url.trim() && !domain && (
          <p className="text-sm text-red-500">Please enter a valid URL (e.g. acme.com)</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!domain || submitting}
          className="w-full px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Setting up..." : "Create Workspace"}
        </button>
      </div>
    </div>
  );
}
