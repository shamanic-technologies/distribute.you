"use client";

/**
 * The end of the brand walk run from the dashboard (`GetStarted` with `org`): where the
 * signed-out walk opens the account and card wall, this opens "Choose your plan" (a plan
 * per brand x offer, NO trial: the 3 days are the first signup's only, owner 2026-10-03).
 * An org that already holds a card launches on the account it has. Then the SAME launch as the signed-out walk
 * (`launchFromPreview`: the campaigns turned on at the campaigns step, each on its own
 * budget), the org marked set up with a token minted FOR it, and only THEN made active
 * (the edge first-run gate would bounce a not-yet-set-up org), and the person lands on
 * the campaign.
 */

import { useEffect, useRef, useState } from "react";
import { useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { getBillingAccount, setApiActiveOrgOverride, type BillingAccount } from "@/lib/api";
import { defaultSalesRepToAccountEmail } from "@/lib/sales-rep-default";
import { v2CampaignHref } from "@/lib/v2/routes";
import type { GetStartedOffer } from "@/lib/v2/get-started";
import { ChoosePlanPanel } from "@/components/v2/choose-plan";
import { EMPTY_PROGRESS, launchFromPreview, type LaunchCampaign, type LaunchProgress } from "./launch";

type Stage = "reading" | "plan" | "ready" | "launching";

export function OrgLaunch({
  orgId,
  brandId,
  website,
  offer,
  targetAudience,
  note,
  campaigns,
  answered,
  snapshotKey,
  onClose,
}: {
  orgId: string;
  brandId: string;
  /** The brand's site, or empty for a brand with no website. */
  website: string;
  offer: GetStartedOffer;
  targetAudience: string;
  note: string | null;
  /** The campaigns as set at the campaigns step: the ones on start, each on its budget. */
  campaigns: LaunchCampaign[];
  answered: boolean;
  snapshotKey: string;
  onClose: () => void;
}) {
  const { user } = useUser();
  const { session } = useSession();
  const { setActive } = useOrganizationList();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const personName = user?.fullName ?? null;

  const [stage, setStage] = useState<Stage>("reading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  // "Try again" replays the launch: every write that landed on an earlier attempt is skipped.
  const progress = useRef<LaunchProgress>({ ...EMPTY_PROGRESS, budgets: {}, started: {}, campaignIds: {} });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "launching") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

  // An org with a card already pays: it launches on the account it has. One with none adds credit.
  useEffect(() => {
    getBillingAccount()
      .then((a) => {
        setAccount(a);
        setStage(a.has_payment_method ? "ready" : "plan");
      })
      .catch((e) => {
        console.error("[brand-walk] billing account read failed:", e);
        setError("We could not read this organization's billing. Close and try again.");
      });
  }, []);

  // A new org pays through Revolut (owner 2026-09-27), declared once before its first
  // card form; an org already holding a card elsewhere keeps paying there.
  const revolutDeclared = useRef(false);
  async function declareRevolut() {
    if (revolutDeclared.current) return;
    const orgToken = await session?.getToken({ organizationId: orgId, skipCache: true });
    if (!orgToken) throw new Error("Your session expired. Sign in again to finish.");
    const res = await fetch("/api/orgs/revolut", { method: "POST", headers: { Authorization: `Bearer ${orgToken}` } });
    if (!res.ok) throw new Error("We could not prepare the payment. Try again.");
    revolutDeclared.current = true;
  }

  // The launch on a plan writes no budget: "Try again" replays it the same way.
  const launchedOnPlan = useRef(false);
  async function launch(onPlan = false) {
    launchedOnPlan.current = onPlan;
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      const campaignId = await launchFromPreview(
        // A plan subscriber's budgets follow its plan (billing refuses a daily one).
        { brandId, website, offer, targetAudience, campaigns, answered, writeBudgets: !onPlan && account?.payment_mode !== "subscription" },
        progress.current,
      );
      await defaultSalesRepToAccountEmail(brandId, email);
      // The edge gate reads this claim: the org is set up only now, with a campaign
      // running. Marked with a token minted FOR it, BEFORE it is made active.
      const orgToken = await session?.getToken({ organizationId: orgId, skipCache: true });
      if (!orgToken) throw new Error("Your session expired. Sign in again to finish.");
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { Authorization: `Bearer ${orgToken}` } });
      if (!res.ok) throw new Error("We could not finish setting up the organization. Try again.");
      if (!setActive) throw new Error("Your session is still loading. Try again in a moment.");
      await setActive({ organization: orgId });
      await session?.getToken({ skipCache: true });
      try {
        localStorage.removeItem(snapshotKey);
      } catch (e) {
        console.error("[brand-walk] snapshot clear failed:", e);
      }
      posthog.capture("brand_walk_launched", { org_id: orgId, brand_id: brandId, campaigns: campaigns.filter((c) => c.on).length });
      setApiActiveOrgOverride(null);
      window.location.assign(v2CampaignHref(orgId, brandId, campaignId));
    } catch (e) {
      console.error("[brand-walk] launch failed:", e);
      setError(e instanceof Error ? e.message : "The launch stopped. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#1010121f] px-3 pt-[8vh]">
      <div role="dialog" aria-modal="true" aria-label="Launch" className="k-popover flex max-h-[84vh] w-full max-w-[560px] flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">{stage === "launching" ? "Launching" : stage === "plan" ? "Choose your plan" : "Launch"}</span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={stage === "launching" && busy}>
            ×
          </button>
        </div>
        <div className="k-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {note && stage !== "launching" && <p className="k-fg2 mb-3 text-[13px]">{note}</p>}

          {stage === "reading" && !error && <p className="k-fg2 text-[13px]">Reading your account...</p>}

          {stage === "ready" && (
            <div className="grid gap-3">
              <p className="k-fg2 text-[13px]">Your campaigns start on this organization&apos;s credit and card.</p>
              <button type="button" className="k-cta k-btn-accent w-full justify-center" onClick={() => void launch()} disabled={busy}>
                Launch
              </button>
            </div>
          )}

          {stage === "plan" && (
            <ChoosePlanPanel
              brandId={brandId}
              offerId={offer.offerId}
              beforeCard={declareRevolut}
              personName={personName}
              email={email}
              onStarted={() => launch(true)}
              onRefused={(code) => {
                // billing keeps this org on what it pays with: it launches on that.
                if (code !== "existing_paying_org") return false;
                setStage("ready");
                return true;
              }}
            />
          )}

          {stage === "launching" && (
            <p className="k-fg2 text-[13px]">{error ? "The launch stopped." : "Creating your audiences and campaigns, then starting them."}</p>
          )}

          {error && (
            <p className="mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
              {error}
            </p>
          )}
          {stage === "launching" && error && (
            <div className="mt-4 flex justify-end">
              <button type="button" className="k-btn-strong" disabled={busy} onClick={() => void launch(launchedOnPlan.current)}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
