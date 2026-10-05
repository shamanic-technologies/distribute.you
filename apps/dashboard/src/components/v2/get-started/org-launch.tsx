"use client";

/**
 * The end of the brand walk run from the dashboard (`GetStarted` with `org`): where the
 * signed-out walk opens the account and card wall, this opens "Choose your plan" (a
 * plan per brand x offer, NO trial: the 3 days are the first signup's only, owner
 * 2026-10-03). Then the SAME launch as the signed-out walk (`launchFromPreview`), the
 * org marked set up with a token minted FOR it, and only THEN made active (the edge
 * first-run gate would bounce a not-yet-set-up org), and the person lands on the campaign.
 *
 * An org billing keeps on pay-as-you-go (`existing_paying_org`) states a daily budget
 * instead and launches on the payment mode it already has (a mode is a tag, never
 * rewritten here).
 */

import { useEffect, useRef, useState } from "react";
import { useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { setApiActiveOrgOverride } from "@/lib/api";
import { defaultSalesRepToAccountEmail } from "@/lib/sales-rep-default";
import { SUBSCRIPTION_OUTBOUND_DAILY_USD } from "@/lib/subscription-plan";
import { v2CampaignHref } from "@/lib/v2/routes";
import type { GetStartedOffer, PlanCampaign } from "@/lib/v2/get-started";
import { ChoosePlanPanel } from "@/components/v2/choose-plan";
import { EMPTY_PROGRESS, launchFromPreview, type LaunchProgress } from "./launch";

type Stage = "plan" | "budget" | "launching";

export function OrgLaunch({
  orgId,
  brandId,
  website,
  offer,
  targetAudience,
  note,
  floorUsd,
  recommendedUsd,
  plan,
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
  floorUsd: number;
  recommendedUsd: number | null;
  plan: PlanCampaign[];
  answered: boolean;
  snapshotKey: string;
  onClose: () => void;
}) {
  const { user } = useUser();
  const { session } = useSession();
  const { setActive } = useOrganizationList();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const personName = user?.fullName ?? null;

  const [stage, setStage] = useState<Stage>("plan");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const floor = Math.ceil(floorUsd);
  const [budget, setBudget] = useState(recommendedUsd != null ? String(Math.max(recommendedUsd, floor)) : "");
  // "Try again" replays the launch: every write that landed on an earlier attempt is skipped.
  const progress = useRef<LaunchProgress>({ ...EMPTY_PROGRESS, budgets: {}, campaignIds: {} });
  const launchedWith = useRef<{ budgetUsd: number; plan: boolean } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "launching") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

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

  async function launch(budgetUsd: number, onPlan: boolean) {
    launchedWith.current = { budgetUsd, plan: onPlan };
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      const campaignId = await launchFromPreview(
        { brandId, website, offer, targetAudience, budgetUsd, plan, answered },
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
      posthog.capture("brand_walk_launched", { org_id: orgId, brand_id: brandId, budget_usd: budgetUsd, plan: onPlan ? "plan" : "pay_as_you_go" });
      setApiActiveOrgOverride(null);
      window.location.assign(v2CampaignHref(orgId, brandId, campaignId));
    } catch (e) {
      console.error("[brand-walk] launch failed:", e);
      setError(e instanceof Error ? e.message : "The launch stopped. Try again.");
      setBusy(false);
    }
  }

  function submitBudget() {
    const usd = Number(budget);
    if (!budget.trim() || !Number.isInteger(usd) || usd < 1) return setError("Enter a whole number of dollars a day.");
    if (usd < floor) return setError(`This channel runs from $${floor} a day.`);
    void launch(usd, false);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#1010121f] px-3 pt-[8vh]">
      <div role="dialog" aria-modal="true" aria-label="Choose your plan" className="k-popover flex max-h-[84vh] w-full max-w-[560px] flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">{stage === "budget" ? "Daily budget" : stage === "launching" ? "Launching" : "Choose your plan"}</span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={stage === "launching" && busy}>
            ×
          </button>
        </div>
        <div className="k-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {note && stage === "plan" && <p className="k-fg2 mb-3 text-[13px]">{note}</p>}

          {stage === "plan" && (
            <ChoosePlanPanel
              brandId={brandId}
              offerId={offer.offerId}
              beforeCard={declareRevolut}
              personName={personName}
              email={email}
              onStarted={() => launch(SUBSCRIPTION_OUTBOUND_DAILY_USD, true)}
              onRefused={(code) => {
                // billing keeps this org on pay-as-you-go: it states its own daily budget.
                if (code !== "existing_paying_org") return false;
                setStage("budget");
                return true;
              }}
            />
          )}

          {stage === "budget" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitBudget();
              }}
            >
              <label className="block">
                <span className="k-label">Dollars a day</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="k-fg3">$</span>
                  <input
                    className="k-input w-28 px-2.5 text-right tabular-nums"
                    inputMode="numeric"
                    value={budget}
                    onChange={(e) => {
                      setBudget(e.target.value.replace(/[^\d]/g, ""));
                      setError(null);
                    }}
                    autoFocus
                  />
                  <span className="k-fg3 text-[13px]">/ day</span>
                </span>
              </label>
              <p className="k-fg3 mt-2 text-[12px]">Spent as your campaigns run, replies first.</p>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="k-btn-strong" disabled={busy}>
                  Launch
                </button>
              </div>
            </form>
          )}

          {stage === "launching" && (
            <p className="k-fg2 text-[13px]">{error ? "The launch stopped." : "Creating your audiences and campaigns, then starting them."}</p>
          )}

          {error && (
            <p className="mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
              {error}
            </p>
          )}
          {stage === "launching" && error && launchedWith.current && (
            <div className="mt-4 flex justify-end">
              <button type="button" className="k-btn-strong" disabled={busy} onClick={() => launchedWith.current && void launch(launchedWith.current.budgetUsd, launchedWith.current.plan)}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
