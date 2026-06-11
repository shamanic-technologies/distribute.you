"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import posthog from "posthog-js";
import { createCheckoutSession } from "@/lib/api";
import { extractDomain } from "@/lib/extract-domain";

type AccountType = "agency" | "company";
type Step = "value-prop" | "type-selection" | "url-input" | "billing-setup";

const DEFAULT_TOPUP_AMOUNT_CENTS = 5000;
const DEFAULT_TOPUP_THRESHOLD_CENTS = 1000;

export default function OnboardingPage() {
  const { createOrganization, setActive } = useOrganizationList();
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  // The "New organization" dropdown entry passes ?new=1 to force a brand-new org
  // even when a populated org is already active. A fresh signup arrives here with
  // no param and an auto-created (brand-less) active org → that org is reused.
  const forceNew = searchParams.get("new") === "1";
  const [step, setStep] = useState<Step>("value-prop");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingBrandUrl, setPendingBrandUrl] = useState("");
  const [pendingOrgId, setPendingOrgId] = useState("");
  const [topupAmount, setTopupAmount] = useState((DEFAULT_TOPUP_AMOUNT_CENTS / 100).toString());
  const [topupThreshold, setTopupThreshold] = useState((DEFAULT_TOPUP_THRESHOLD_CENTS / 100).toString());
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  const domain = extractDomain(url);
  const topupAmountNumber = parseFloat(topupAmount);
  const topupThresholdNumber = parseFloat(topupThreshold);
  const topupAmountError = topupAmount && topupAmountNumber < 10 ? "Minimum top-up amount is $10." : null;
  const topupThresholdError = topupThreshold && topupThresholdNumber < 5 ? "Minimum threshold is $5." : null;
  const hasBillingValidationError =
    !topupAmount ||
    !topupThreshold ||
    Number.isNaN(topupAmountNumber) ||
    Number.isNaN(topupThresholdNumber) ||
    !!topupAmountError ||
    !!topupThresholdError;

  useEffect(() => {
    posthog.capture("onboarding_step_viewed", { step });
  }, [step]);

  useEffect(() => {
    const billingStatus = searchParams.get("billing");
    if (billingStatus !== "cancelled" && billingStatus !== "required") return;

    const returnedBrandUrl = searchParams.get("brandUrl") ?? "";
    const returnedAccountType = searchParams.get("accountType");
    const returnedOrgId = searchParams.get("orgId") ?? "";
    const returnedTopup = searchParams.get("topup");
    const returnedThreshold = searchParams.get("threshold");

    setPendingBrandUrl(returnedBrandUrl);
    setPendingOrgId(returnedOrgId);
    setUrl(returnedBrandUrl);
    if (returnedAccountType === "agency" || returnedAccountType === "company") {
      setAccountType(returnedAccountType);
    }
    if (returnedTopup) {
      const returnedTopupCents = parseInt(returnedTopup, 10);
      if (Number.isFinite(returnedTopupCents)) setTopupAmount((returnedTopupCents / 100).toString());
    }
    if (returnedThreshold) {
      const returnedThresholdCents = parseInt(returnedThreshold, 10);
      if (Number.isFinite(returnedThresholdCents)) setTopupThreshold((returnedThresholdCents / 100).toString());
    }
    setBillingError(
      billingStatus === "cancelled"
        ? "Card setup was cancelled. Add a card to finish onboarding."
        : "Add a card to finish onboarding."
    );
    setStep("billing-setup");
  }, [searchParams]);

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
      setPendingBrandUrl(brandUrl);
      setPendingOrgId(targetOrgId);
      setStep("billing-setup");
    } catch (err) {
      posthog.capture("onboarding_workspace_create_failed", {
        account_type: accountType,
        domain,
      });
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBillingCheckout = async () => {
    if (!pendingBrandUrl || !pendingOrgId || !accountType || hasBillingValidationError) return;
    setBillingLoading(true);
    setBillingError(null);
    const topupAmountCents = Math.round(topupAmountNumber * 100);
    const topupThresholdCents = Math.round(topupThresholdNumber * 100);
    posthog.capture("onboarding_billing_setup_started", {
      account_type: accountType,
      org_id: pendingOrgId,
      topup_amount_cents: topupAmountCents,
      topup_threshold_cents: topupThresholdCents,
    });
    try {
      const successUrl = new URL(`/orgs/${pendingOrgId}/brands`, window.location.origin);
      successUrl.searchParams.set("autoCreate", pendingBrandUrl);
      successUrl.searchParams.set("billingSetup", "success");
      successUrl.searchParams.set("pending_topup", topupAmountCents.toString());
      successUrl.searchParams.set("pending_threshold", topupThresholdCents.toString());

      const cancelUrl = new URL("/onboarding", window.location.origin);
      cancelUrl.searchParams.set("billing", "cancelled");
      cancelUrl.searchParams.set("brandUrl", pendingBrandUrl);
      cancelUrl.searchParams.set("accountType", accountType);
      cancelUrl.searchParams.set("orgId", pendingOrgId);
      cancelUrl.searchParams.set("topup", topupAmountCents.toString());
      cancelUrl.searchParams.set("threshold", topupThresholdCents.toString());

      const session = await createCheckoutSession({
        mode: "setup",
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
      });
      window.location.href = session.url;
    } catch (err) {
      posthog.capture("onboarding_billing_setup_failed", {
        account_type: accountType,
        org_id: pendingOrgId,
      });
      setBillingError(err instanceof Error ? err.message : "Failed to start card setup");
      setBillingLoading(false);
    }
  };

  // Step 1: Value Proposition
  if (step === "value-prop") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12 text-center">
        <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold text-gray-900 mb-4">
          Welcome to Distribute
        </h1>
        <p className="text-lg text-gray-600 mb-3">
          The done-for-you distribution automation platform.
        </p>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Full control over your distribution strategy. Crowdsourced best practices from the industry — always the best available strategy. $25 free to start, no subscription.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-left">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">Done for you</h3>
            <p className="text-xs text-gray-500">Automated lead finding, outreach, emails & reporting</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">Full control</h3>
            <p className="text-xs text-gray-500">Choose strategies, set budgets, monitor results in real time</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="w-8 h-8 bg-brand-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 text-sm mb-1">Crowdsourced</h3>
            <p className="text-xs text-gray-500">Proven best strategies from the community</p>
          </div>
        </div>
        <button
          onClick={() => setStep("type-selection")}
          className="px-8 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition font-medium text-lg"
        >
          Get Started
        </button>
      </div>
    );
  }

  // Step 2: Type Selection
  if (step === "type-selection") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
        <button
          onClick={() => setStep("value-prop")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
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
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
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
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
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

  if (step === "billing-setup") {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
        <button
          onClick={() => setStep("url-input")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="w-12 h-12 bg-brand-100 rounded-xl flex items-center justify-center mb-5">
          <svg className="w-6 h-6 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h.01M11 15h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
          Set up billing
        </h2>
        <p className="text-gray-500 mb-6">
          You get $25 in free credits first. Add a card now so campaigns can keep running when credits run low.
        </p>

        <div className="-mx-8 md:-mx-12 border-y border-brand-200 bg-brand-50 px-8 md:px-12 py-4 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Pay-As-You-Go</p>
              <p className="text-sm text-gray-600 mt-1">No subscription. Your card is only used for future top-ups.</p>
            </div>
            <span className="text-xs font-medium text-brand-700 bg-white border border-brand-200 rounded-full px-2.5 py-1">
              $0 today
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Top-up amount</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                min="10"
                step="5"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className={`w-full pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${topupAmountError ? "border-red-300" : "border-gray-200"}`}
              />
            </div>
            {topupAmountError && <p className="text-xs text-red-600 mt-1">{topupAmountError}</p>}
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Top up when below</span>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                min="5"
                step="5"
                value={topupThreshold}
                onChange={(e) => setTopupThreshold(e.target.value)}
                className={`w-full pl-7 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 ${topupThresholdError ? "border-red-300" : "border-gray-200"}`}
              />
            </div>
            {topupThresholdError && <p className="text-xs text-red-600 mt-1">{topupThresholdError}</p>}
          </label>
        </div>

        <div className="space-y-2 text-sm text-gray-600 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Your $25 free credits are used before any paid top-up.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Auto top-up adds ${topupAmount || "50"} when your balance drops below ${topupThreshold || "10"}.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            You can change this anytime from billing settings.
          </div>
        </div>

        {billingError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
            {billingError}
          </div>
        )}

        <button
          onClick={handleBillingCheckout}
          disabled={!pendingBrandUrl || !pendingOrgId || billingLoading || hasBillingValidationError}
          className="w-full px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {billingLoading ? "Redirecting to Stripe..." : "Add card"}
        </button>
        <p className="text-xs text-center text-gray-400 mt-3">
          Secure checkout by Stripe. No charge today.
        </p>
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
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
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
