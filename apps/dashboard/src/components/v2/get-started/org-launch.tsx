"use client";

/**
 * The end of the brand walk run from the dashboard (`GetStarted` with `org`): where the
 * signed-out walk opens the account and credit wall, this opens the credit step (owner
 * 2026-10-06: prepaid, no plan, no trial). An org that already holds a card launches on
 * the account it has; one with no card adds prepaid credit first (`PrepaidTopup`, at
 * least $100, optional automatic reload). Then the SAME launch as the signed-out walk
 * (`launchFromPreview`: the campaigns turned on at the campaigns step, each on its own
 * budget), the org marked set up with a token minted FOR it, and only THEN made active
 * (the edge first-run gate would bounce a not-yet-set-up org), and the person lands on
 * the campaign.
 */

import { useEffect, useRef, useState } from "react";
import { useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import posthog from "posthog-js";
import { getBillingAccount, sendAuthNotification, setApiActiveOrgOverride, type BillingAccount } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { defaultSalesRepToAccountEmail } from "@/lib/sales-rep-default";
import { v2CampaignHref } from "@/lib/v2/routes";
import { dailySpendUsd, matchNote, type GetStartedOffer } from "@/lib/v2/get-started";
import { EMPTY_PROGRESS, launchFromPreview, type LaunchCampaign, type LaunchProgress } from "./launch";
import { PrepaidTopup, type TopupChoice } from "./prepaid-topup";
import { payTopup, settleTopup } from "./pay-topup";
import { pingOwner } from "@/lib/owner-ping-client";
import { hostOf as pingHostOf, websiteUrl as pingWebsiteUrl } from "@/lib/v2/get-started";

type Stage = "reading" | "credit" | "ready" | "launching";

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

  const [stage, setStage] = useState<Stage>("reading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);
  const [cardSecret, setCardSecret] = useState<string | null>(null);
  const [paid, setPaid] = useState<{ creditedBefore: number; reload: TopupChoice["reload"] } | null>(null);
  const pending = useRef<{ creditedBefore: number; reload: TopupChoice["reload"] } | null>(null);
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
        setStage(a.has_payment_method ? "ready" : "credit");
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

  async function pay(choice: TopupChoice) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await declareRevolut();
      const opened = await payTopup({
        amountUsd: choice.topupUsd,
        // Only an org created under the offer starts prepaid; an older one keeps its mode.
        setPrepaid: account?.free_credit_offer === "match_100",
        name: user?.fullName ?? undefined,
        email: email ?? undefined,
        onPaid: (creditedBefore) => void afterPaid({ creditedBefore, reload: choice.reload }),
        onCancel: () => setBusy(false),
        onError: (message) => {
          setError(message);
          setBusy(false);
        },
      });
      if (opened.clientSecret) {
        pending.current = { creditedBefore: opened.creditedBefore, reload: choice.reload };
        setCardSecret(opened.clientSecret);
        setBusy(false);
      }
    } catch (e) {
      console.error("[brand-walk] top-up failed to open:", e);
      setError(e instanceof Error ? e.message : "We could not open the card form.");
      setBusy(false);
    }
  }

  async function afterPaid(p: { creditedBefore: number; reload: TopupChoice["reload"] }) {
    setCardSecret(null);
    setPaid(p);
    setBusy(true);
    setError(null);
    const settled = await settleTopup(p.creditedBefore, p.reload);
    if (!settled.ok) {
      setError(settled.message);
      setBusy(false);
      return;
    }
    setAccount(settled.account);
    // The first-payment email (owner 2026-10-07): transactional-email sends it once per
    // org and user, so a later top-up through here never sends it again.
    sendAuthNotification("first_payment").catch((e) => console.error("[get-started] first_payment email failed:", e));
    pingOwner({ event: "paid", domain: website ? pingHostOf(pingWebsiteUrl(website)) : null, amountUsd: (Number(settled.account.credited_cents) - p.creditedBefore) / 100 });
    void launch();
  }

  async function launch() {
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      const campaignId = await launchFromPreview(
        // A plan subscriber's budgets follow its plan (billing refuses a daily one).
        { brandId, website, offer, targetAudience, campaigns, answered, writeBudgets: account?.payment_mode !== "subscription" },
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
      pingOwner({ event: "launched", domain: website ? pingHostOf(pingWebsiteUrl(website)) : null });
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
          <span className="k-label">{stage === "launching" ? "Launching" : stage === "credit" ? "Add credit" : "Launch"}</span>
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

          {stage === "credit" && !cardSecret && (
            paid ? (
              <button type="button" className="k-cta k-btn-accent w-full justify-center" onClick={() => void afterPaid(paid)} disabled={busy}>
                {busy ? "Checking your payment..." : "Check my payment and launch"}
              </button>
            ) : (
              <PrepaidTopup busy={busy} matchNote={matchNote(account)} dailyUsd={dailySpendUsd(campaigns)} onEditCampaigns={onClose} cta={(usd) => `Add $${usd.toLocaleString("en-US")} and launch`} onPay={(c) => void pay(c)} />
            )
          )}

          {stage === "credit" && cardSecret && (
            <EmbeddedCheckoutProvider
              stripe={getStripe()}
              options={{
                clientSecret: cardSecret,
                onComplete: () => {
                  const held = pending.current;
                  if (held) void afterPaid(held);
                },
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
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
              <button type="button" className="k-btn-strong" disabled={busy} onClick={() => void launch()}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
