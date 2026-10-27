"use client";

/**
 * The end of the brand walk run from the dashboard (`GetStarted` with `org`): where the
 * signed-out walk opens the account and credit wall, this opens the credit step (owner
 * 2026-10-06: prepaid, no plan, no trial). An org that already holds a card launches on
 * the account it has; one with no card adds prepaid credit first (`PrepaidTopup`, at
 * least $100, the automatic reload required). Then the SAME launch as the signed-out walk
 * (`launchFromPreview`: the funnel campaign set at the "Your campaign" step, its caps
 * first), the org marked set up with a token minted FOR it, and only THEN made active
 * (the edge first-run gate would bounce a not-yet-set-up org), and the person lands on
 * the campaign.
 *
 * A POSTPAID org launches only once billing's $50 card check opened its credit line
 * (ORG-LAUNCH-CARD-REFUSED-1028, `orgLaunchStart`): refused = the wall's choice (another
 * card, checked again, or prepaid credit, the person picks), never checked = the check
 * runs first. A saved card alone is not "already pays".
 */

import { useEffect, useRef, useState } from "react";
import { useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import posthog from "posthog-js";
import {
  ApiError,
  createEmbeddedCardSetup,
  getBillingAccount,
  getSavedCardFacts,
  sendAuthNotification,
  setApiActiveOrgOverride,
  setPaymentMode,
  type BillingAccount,
} from "@/lib/api";
import {
  CARD_CHECK_UNFINISHED,
  cardRiskCopy,
  orgLaunchStart,
  postpaidCardCheckSecret,
  postpaidRefusalFacts,
  refusedCheckFacts,
  type CardFacts,
  type CardRiskCopy,
} from "@/lib/v2/card-risk";
import { consentRecord, spendConsentLines } from "@/lib/v2/spend-consent";
import { CardRiskNotice } from "./card-risk-notice";
import { SpendConsent, allTicked } from "./spend-consent";
import { getStripe } from "@/lib/stripe";
import { defaultSalesRepToAccount } from "@/lib/sales-rep-default";
import { v2Href } from "@/lib/v2/routes";
import { matchNote, topupCta, type GetStartedOffer } from "@/lib/v2/get-started";
import { launchCount, type SignupLaunchPlan } from "@/lib/v2/signup-campaign";
import { EMPTY_PROGRESS, launchFromPreview, type LaunchProgress } from "./launch";
import { PrepaidTopup, type TopupChoice } from "./prepaid-topup";
import { payTopup, settleTopup } from "./pay-topup";
import { pingOwner } from "@/lib/owner-ping-client";
import { sendLaunchEmail } from "@/lib/signup-emails";
import { hostOf as pingHostOf, websiteUrl as pingWebsiteUrl } from "@/lib/v2/get-started";

type Stage = "reading" | "credit" | "ready" | "card" | "launching";

export function OrgLaunch({
  orgId,
  brandId,
  website,
  offer,
  targetAudience,
  note,
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
  /** The campaign set at the "Your campaign" step (the funnels and their caps). */
  plan: SignupLaunchPlan;
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
  // The postpaid card check (stage "card"): billing's refusal shown, or the check still to run.
  const [cardRisk, setCardRisk] = useState<CardFacts | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [chosePrepaid, setChosePrepaid] = useState(false);
  const postpaidConsent = spendConsentLines({ arm: { kind: "postpaid" } });
  const [postpaidTicked, setPostpaidTicked] = useState([false, false]);
  const knownCard = useRef<CardFacts | null>(null);
  const cardSaved = useRef<(() => void) | null>(null);
  // "Try again" replays the launch: every write that landed on an earlier attempt is skipped.
  const progress = useRef<LaunchProgress>({ ...EMPTY_PROGRESS, caps: {}, started: {}, campaignIds: {} });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "launching") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

  // An org with a card launches on the account it has, except a postpaid one whose $50 card
  // check did not open its credit line (`orgLaunchStart`). One with no card adds credit.
  useEffect(() => {
    getBillingAccount()
      .then(async (a) => {
        setAccount(a);
        const start = orgLaunchStart(a);
        if (start === "ready" || start === "credit") {
          setStage(start);
          return;
        }
        // The saved card's id, so "Use another card" tells the new card from this one.
        knownCard.current = await getSavedCardFacts().catch((e) => {
          console.error("[brand-walk] saved card read failed:", e);
          return null;
        });
        if (start === "card_refused") {
          posthog.capture("get_started_card_risk_shown", { arm: "postpaid", reason: "card_hold_refused", source: "org_launch" });
          setCardRisk(refusedCheckFacts(a.postpaid_card_check_message, knownCard.current));
        }
        setStage("card");
      })
      .catch((e) => {
        console.error("[brand-walk] billing account read failed:", e);
        setError("We could not read this organization's billing. Close and try again.");
      });
  }, []);

  async function pay(choice: TopupChoice) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const opened = await payTopup({
        amountUsd: choice.topupUsd,
        consent: choice.consent,
        // Only an org created under the offer starts prepaid; an older one keeps its mode,
        // unless the person picked "Switch to prepaid" on a card post-paid cannot run on.
        setPrepaid: chosePrepaid || account?.free_credit_offer === "match_100",
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
    if (settled.reloadRefused) posthog.capture("get_started_reload_refused", { reload_usd: p.reload?.amountUsd ?? null });
    // The first-payment email (owner 2026-10-07): transactional-email sends it once per
    // org and user, so a later top-up through here never sends it again.
    sendAuthNotification("first_payment").catch((e) => console.error("[get-started] first_payment email failed:", e));
    pingOwner({ event: "paid", domain: website ? pingHostOf(pingWebsiteUrl(website)) : null, amountUsd: (Number(settled.account.credited_cents) - p.creditedBefore) / 100 });
    void launch();
  }

  // billing runs the $50 card check on `PUT payment_mode {postpaid}` for an org already
  // postpaid whose check did not pass (the wall's `armPostpaid`): passed = launch; refused =
  // the choice; a bank that wants 3-D Secure gets Stripe's step, then billing is asked again.
  async function checkCard() {
    setBusy(true);
    setError(null);
    // The boxes are ticked only on a card never checked; another card after a refusal
    // rides the consent the wall already stored.
    const consent = allTicked(postpaidTicked) ? consentRecord(postpaidConsent, new Date(), navigator.userAgent) : undefined;
    const putPostpaid = () => setPaymentMode("postpaid", undefined, consent);
    try {
      try {
        await putPostpaid();
      } catch (e) {
        const clientSecret = e instanceof ApiError && e.status === 409 ? postpaidCardCheckSecret(e.body) : null;
        if (!clientSecret) throw e;
        const stripe = await getStripe();
        if (!stripe) console.error("[brand-walk] Stripe.js did not load for the card confirmation");
        else {
          const confirmed = await stripe.handleNextAction({ clientSecret });
          if (confirmed.error) console.error("[brand-walk] card confirmation:", confirmed.error);
        }
        await putPostpaid();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && postpaidCardCheckSecret(e.body)) {
        setError(CARD_CHECK_UNFINISHED);
        setBusy(false);
        return;
      }
      const refused = e instanceof ApiError && e.status === 409 ? postpaidRefusalFacts(e.body, knownCard.current) : null;
      if (refused) {
        posthog.capture("get_started_card_risk_shown", { arm: "postpaid", reason: refused.refusedReason, source: "org_launch" });
        setCardRisk(refused);
      } else {
        console.error("[brand-walk] card check did not run:", e);
        setError("We could not check your card. Press the button again.");
      }
      setBusy(false);
      return;
    }
    void launch();
  }

  // A card in-page that charges nothing (Stripe's embedded form; Revolut's widget).
  async function openCardSave(onSaved: () => void) {
    setBusy(true);
    setError(null);
    try {
      const setup = await createEmbeddedCardSetup();
      if (setup.mode === "embedded_checkout") {
        cardSaved.current = onSaved;
        setSetupSecret(setup.client_secret);
        setBusy(false);
        return;
      }
      if (setup.mode === "embedded_widget") {
        const { openCardWidget } = await import("@/lib/card-setup-widget");
        await openCardWidget({
          token: setup.token,
          environment: setup.environment,
          savePaymentMethodFor: setup.save_payment_method_for,
          name: setup.customer_name ?? user?.fullName ?? undefined,
          email: setup.customer_email ?? email ?? undefined,
          onSuccess: () => {
            setBusy(true);
            onSaved();
          },
          onCancel: () => setBusy(false),
          onError: (message) => {
            setError(message);
            setBusy(false);
          },
        });
        return;
      }
      console.error("[brand-walk] card setup answered a hosted page to an in-page request", setup);
      throw new Error("[brand-walk] card setup: no in-page card form");
    } catch (e) {
      console.error("[brand-walk] card setup failed to open:", e);
      setError("We could not open the card form. Try again.");
      setBusy(false);
    }
  }

  // "Use another card": the new card reaches billing through the provider's webhook a
  // moment after the form reports it, then billing's own verdict on it, then the check.
  function pickAnotherCard() {
    const previousId = cardRisk?.methodId ?? knownCard.current?.methodId ?? null;
    posthog.capture("get_started_card_risk_another_card", { arm: "postpaid", source: "org_launch" });
    setCardRisk(null);
    void openCardSave(() =>
      void (async () => {
        setSetupSecret(null);
        setBusy(true);
        let facts: CardFacts | null = null;
        for (let i = 0; i < 12 && !facts; i++) {
          const read = await getSavedCardFacts().catch((e) => {
            console.error("[brand-walk] saved card read failed:", e);
            return null;
          });
          if (read?.saved && read.methodId !== previousId) facts = read;
          else await new Promise((r) => setTimeout(r, 1000));
        }
        if (!facts) {
          console.error("[brand-walk] the new card did not reach billing in time");
          setError("Your new card is still being saved. Wait a few seconds and press the button again.");
          setBusy(false);
          return;
        }
        knownCard.current = facts;
        if (cardRiskCopy("postpaid", facts)) {
          setCardRisk(facts);
          setBusy(false);
          return;
        }
        await checkCard();
      })(),
    );
  }

  // "Switch to prepaid": the prepaid credit step takes over, chosen by the person.
  function cardRiskSecondary(action: CardRiskCopy["secondaryAction"]) {
    posthog.capture("get_started_card_risk_secondary", { arm: "postpaid", action, source: "org_launch" });
    if (action !== "prepaid") {
      console.error("[brand-walk] post-paid card choice offered a way past", action);
      return;
    }
    setCardRisk(null);
    setChosePrepaid(true);
    setStage("credit");
  }

  async function launch() {
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      await launchFromPreview(
        { brandId, website, offer, targetAudience, plan, answered },
        progress.current,
      );
      await defaultSalesRepToAccount(brandId, user);
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
      posthog.capture("brand_walk_launched", { org_id: orgId, brand_id: brandId, campaigns: launchCount(plan) });
      await sendLaunchEmail().catch((e) => console.error("[brand-walk] launch email failed:", e));
      setApiActiveOrgOverride(null);
      pingOwner({ event: "launched", domain: website ? pingHostOf(pingWebsiteUrl(website)) : null });
      window.location.assign(v2Href(orgId, brandId, "today"));
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

          {stage === "card" && !setupSecret && cardRisk && (
            <CardRiskNotice copy={cardRiskCopy("postpaid", cardRisk)} busy={busy} onAnotherCard={pickAnotherCard} onSecondary={cardRiskSecondary} />
          )}

          {stage === "card" && !setupSecret && !cardRisk && (
            <div className="grid gap-3">
              <p className="k-fg2 text-[13px]">Your campaigns start on this card. You pay after they spend.</p>
              <SpendConsent lines={postpaidConsent} ticked={postpaidTicked} onChange={setPostpaidTicked} disabled={busy} />
              <button type="button" className="k-cta k-btn-accent w-full justify-center" onClick={() => void checkCard()} disabled={busy || !allTicked(postpaidTicked)}>
                {busy ? "Checking your card..." : "Launch"}
              </button>
            </div>
          )}

          {stage === "card" && setupSecret && (
            <EmbeddedCheckoutProvider
              stripe={getStripe()}
              options={{
                clientSecret: setupSecret,
                onComplete: () => cardSaved.current?.(),
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}

          {stage === "credit" && !cardSecret && (
            paid ? (
              <button type="button" className="k-cta k-btn-accent w-full justify-center" onClick={() => void afterPaid(paid)} disabled={busy}>
                {busy ? "Checking your payment..." : "Check my payment and launch"}
              </button>
            ) : (
              <PrepaidTopup busy={busy} matchNote={matchNote(account)} cta={(usd) => topupCta(usd, matchNote(account))} onPay={(c) => void pay(c)} />
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
