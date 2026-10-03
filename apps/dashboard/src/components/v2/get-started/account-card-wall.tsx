"use client";

/**
 * The one wall of `/get-started`: the account and the card, on ONE screen, opened as a
 * layer OVER the results the founder just watched (blurred behind it), the way Explee
 * opens its paywall. The product stays in view while they pay.
 *
 * Left: what the $30 is, what it buys (a SERVED fleet price, or nothing), the email we
 * wrote kept sharp ("this one goes out when you start"), and a rotating card per named
 * client who agreed to be shown. Right: the countdown and spots strips (owner-decided,
 * copied from Explee), then the form.
 *
 * The form walks four states in place, never navigating away (the Google button is the
 * one exception, and it comes straight back here with `?resume=1`):
 *   1. account  — work email, then the emailed 6-digit code (no password to invent), or Google;
 *   2. claim    — the anonymous org they built is re-pointed at the account they just
 *                 made (`/api/anon/claim`, the same hinge `/onboarding/claim` runs);
 *   3. card     — the card form opens in the same column by itself, charging nothing:
 *                 the $30 free credit is spent first, then the card is charged at most
 *                 the daily budget;
 *   4. launch   — the preview becomes a running campaign (`launch.ts`), and the page
 *                 lands on its mission.
 */

import { defaultSalesRepToAccountEmail } from "@/lib/sales-rep-default";
import { useEffect, useRef, useState } from "react";
import { BRAND_WHY } from "@/lib/brand-why";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import { useAuth, useSession, useUser } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import posthog from "posthog-js";
import {
  ApiError,
  configureAutoTopup,
  createEmbeddedCardSetup,
  createSubscriptionCheckout,
  getBillingAccount,
  getSubscription,
  setPaymentMode,
  startSubscription,
  type BillingAccount,
  type CardSetup,
} from "@/lib/api";
import {
  SUBSCRIPTION_MONTHLY_CENTS,
  SUBSCRIPTION_OUTBOUND_DAILY_USD,
  isSubscriptionArm,
  pickedPlanCents,
  subscriptionCheckoutRefusal,
} from "@/lib/subscription-plan";
import { getStripe } from "@/lib/stripe";
import {
  authFailureProps,
  clerkErrorMessage,
  sanitizeVerificationCode,
  VERIFICATION_CODE_LENGTH,
} from "@/lib/clerk-error";
import { v2MissionHref } from "@/lib/v2/routes";
import {
  GET_STARTED_SNAPSHOT_KEY,
  hotLeadsForCredit,
  nextSlide,
  parseDailyBudget,
  type GetStartedEmail,
  type GetStartedAudience,
  type GetStartedOffer,
  type PlanCampaign,
  wallCopy,
} from "@/lib/v2/get-started";
import { formatReturn, useStartCatalogue } from "@/components/start/start-picks";
import { EMPTY_PROGRESS, launchFromPreview, pricingLegFor, recommendedBudgetForPreview, type LaunchProgress } from "./launch";
import { CountUp, usePrefersReducedMotion } from "./motion";
import { TrialSpots, TrialTimer } from "./urgency";
import { WALL_OPEN_CLASS } from "./view-transition";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** How long a sign-up may wait on the bot check before we say a box needs ticking. */
const CAPTCHA_PROMPT_DELAY_MS = 2500;
const RESEND_COOLDOWN_SECONDS = 30;
const SLIDE_MS = 6000;

type Stage = "account" | "code" | "claim" | "card" | "launching";

/**
 * The instance requires a password on every account. Nobody types one here: the
 * account is proven by the emailed code, and signing in later is by a code too.
 */
function generatedPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("")}Aa1!`;
}

export function AccountCardWall({
  brandId,
  website,
  brandName,
  offer,
  audience,
  targetAudience,
  note = null,
  email: writtenEmail,
  floorUsd,
  recommendedUsd,
  budgetChosen = false,
  plan,
  entryLegKey,
  answered,
  onBudget,
  onClose,
}: {
  brandId: string;
  website: string;
  brandName: string;
  /** The offer picked at step 3. */
  offer: GetStartedOffer;
  /** The audience picked at step 4. */
  audience: GetStartedAudience;
  /** Who the brand sells to (the ICP text): the launch builds every audience from it. */
  targetAudience: string;
  /** Why the wall opened, when it was not the visitor's own click (the free emails ran out). */
  note?: string | null;
  /** The email the preview wrote, or null when none was written. */
  email: GetStartedEmail | null;
  floorUsd: number;
  recommendedUsd: number | null;
  /** The budget was typed by the person earlier (restored after a round trip): a price that lands later must not replace it. */
  budgetChosen?: boolean;
  /** Every campaign the ranked paths need (`launchPlan`), the path launched first first. */
  plan: PlanCampaign[];
  /** The entry leg of the path launched first: it prices the recommended budget. */
  entryLegKey: string | null;
  /** The offer points and give lists were answered in the preview (and saved). */
  answered: boolean;
  onBudget: (usd: number) => void;
  onClose: () => void;
}) {
  const { isLoaded: authLoaded, isSignedIn, orgId } = useAuth();
  const { session } = useSession();
  const { user } = useUser();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { catalogue } = useStartCatalogue();

  // The landing's $99/month arm (owner 2026-10-01): the same wall, but the card opens
  // billing's 3-day trial subscription and the plan sets the daily money. Read once.
  const [subscription] = useState(() => isSubscriptionArm(document.cookie));
  const [monthlyCents] = useState(() => pickedPlanCents(document.cookie));
  const copy = subscription
    ? wallCopy({ subscription: true, monthlyCents, creditCents: SUBSCRIPTION_MONTHLY_CENTS })
    : wallCopy({ subscription: false });

  const [stage, setStage] = useState<Stage>("account");
  const [email, setEmail] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  // The price read once the brand has an owner (and therefore an offer) wins over the
  // one the preview could read signed out, which is none for a brand with no offer yet.
  const [pricedUsd, setPricedUsd] = useState<number | null>(null);
  const [pricing, setPricing] = useState(false);
  const recommendation = pricedUsd ?? recommendedUsd;
  // No price held yet: the channel's own floor, the smallest budget it runs on.
  const [budget, setBudget] = useState(
    String(subscription ? SUBSCRIPTION_OUTBOUND_DAILY_USD : recommendation ?? Math.ceil(floorUsd)),
  );
  const [busy, setBusy] = useState(false);
  // The claim has its own flag: the code form's `finally` clears `busy` while the
  // claim this sign-in started is still in flight.
  const [claiming, setClaiming] = useState(false);
  const [captchaWaiting, setCaptchaWaiting] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardSecret, setCardSecret] = useState<string | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);

  const claimed = useRef(false);
  const cardOpened = useRef(false);
  const progress = useRef<LaunchProgress>({ ...EMPTY_PROGRESS });

  // A recommendation that lands after the wall opened fills an untouched field.
  // The plan's budget is fixed: nothing lands over it.
  const budgetTouched = useRef(budgetChosen || subscription);
  useEffect(() => {
    if (!budgetTouched.current) setBudget(String(recommendation ?? Math.ceil(floorUsd)));
  }, [recommendation, floorUsd]);

  // Esc closes while nothing is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && stage !== "launching") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, stage, onClose]);

  // The page behind does not scroll while the wall is up, and the stage's view
  // transitions stand down (`WALL_OPEN_CLASS`): their snapshots paint in the top
  // layer, above this layer, so a step finishing behind it would show through sharp.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add(WALL_OPEN_CLASS);
    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove(WALL_OPEN_CLASS);
    };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // Once signed in, claim the anonymous org. Clerk needs both the user and the org it
  // auto-creates at signup before the claim can name the org to point at.
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !orgId || claimed.current) return;
    claimed.current = true;
    setStage("claim");
    void (async () => {
      setClaiming(true);
      setError(null);
      try {
        const res = await fetch("/api/anon/claim", { method: "POST" });
        if (!res.ok) {
          console.error(`[get-started] claim failed: ${res.status}`);
          throw new Error("We could not attach your setup to your account. Try again.");
        }
        await session?.getToken({ skipCache: true });
        posthog.capture("get_started_claimed");
        const acct = await getBillingAccount();
        setAccount(acct);
        setStage("card");
        // Price the budget the way the "Add a brand" modal does, now that the brand
        // can hold an offer. Best effort: the field keeps the floor when no price exists.
        setPricing(true);
        const pricingLeg = pricingLegFor(entryLegKey);
        (pricingLeg ? recommendedBudgetForPreview(brandId, offer.offerId, floorUsd, pricingLeg) : Promise.resolve(null))
          .then((usd) => setPricedUsd(usd == null ? null : Math.max(usd, Math.ceil(floorUsd))))
          .catch((e) => console.error("[get-started] budget price read failed:", e))
          .finally(() => setPricing(false));
      } catch (e) {
        claimed.current = false;
        setError(e instanceof Error ? e.message : "We could not finish setting up your account.");
      } finally {
        setClaiming(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn, orgId, session]);

  // The card form opens by itself once the account exists: no extra click between
  // the code and the card. Only when the terms were already accepted (a Google return
  // comes back with the box unticked, and then the button asks for it).
  useEffect(() => {
    if (stage !== "card" || cardOpened.current || busy || claiming || !consent || !account) return;
    cardOpened.current = true;
    void addCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, busy, claiming, consent, account]);

  const parsedBudget = parseDailyBudget(budget, subscription ? 1 : floorUsd);
  const budgetUsd = "usd" in parsedBudget ? parsedBudget.usd : null;

  function checkReady(scope: "account" | "card" = "card"): boolean {
    if (!consent) {
      setError(`Tick the box to let us email on behalf of ${brandName}.`);
      return false;
    }
    if (scope === "account") return true;
    if ("problem" in parsedBudget) {
      setError(parsedBudget.problem);
      return false;
    }
    if (budgetTouched.current) onBudget(parsedBudget.usd);
    return true;
  }

  // ── Account ──
  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded || !signUp || busy) return;
    if (!checkReady("account")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    // A managed bot check can ask for a tick. Say so rather than leave a spinner.
    const waiting = setTimeout(() => setCaptchaWaiting(true), CAPTCHA_PROMPT_DELAY_MS);
    try {
      posthog.capture("get_started_signup_email_started");
      await signUp.create({ emailAddress: email.trim(), password: generatedPassword() });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("code");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      posthog.capture("get_started_signup_failed", authFailureProps(err, { stage: "create" }));
      console.error("[get-started] sign up failed:", err);
      setError(clerkErrorMessage(err));
    } finally {
      clearTimeout(waiting);
      setCaptchaWaiting(false);
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded || !signUp || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status !== "complete") {
        posthog.capture("get_started_signup_incomplete", { status: result.status ?? "unknown" });
        throw new Error(`We could not finish creating the account (${result.status}). Check the code and retry.`);
      }
      await setActive({ session: result.createdSessionId });
      posthog.capture("get_started_signup_verified");
      // The claim effect takes over once Clerk reports the user and its org.
    } catch (err) {
      posthog.capture("get_started_signup_failed", authFailureProps(err, { stage: "verify" }));
      console.error("[get-started] code failed:", err);
      setError(err instanceof Error && !("errors" in (err as object)) ? err.message : clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!signUpLoaded || !signUp || busy || resendIn > 0) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setCode("");
      setNotice(`New code sent to ${email.trim()}. Only the newest one works.`);
    } catch (err) {
      console.error("[get-started] resend failed:", err);
      setError(clerkErrorMessage(err));
    }
  }

  async function google() {
    if (!signUpLoaded || !signUp || busy) return;
    if (!checkReady("account")) return;
    setBusy(true);
    setError(null);
    try {
      posthog.capture("get_started_signup_google_started");
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/get-started?resume=1",
      });
    } catch (err) {
      console.error("[get-started] google sign up failed:", err);
      setError(clerkErrorMessage(err));
      setBusy(false);
    }
  }

  // ── Card ──
  async function declareRevolut() {
    const token = await session?.getToken({ skipCache: true });
    if (!token) throw new Error("Your session expired. Sign in again to finish.");
    const res = await fetch("/api/orgs/revolut", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("We could not prepare the card form. Try again.");
  }

  async function addCard() {
    if (busy) return;
    if (!checkReady()) return;
    if (subscription) {
      void openTrialCheckout();
      return;
    }
    if (account?.has_payment_method) {
      void launch(account);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await declareRevolut();
      const setup = await createEmbeddedCardSetup();
      if (setup.mode === "embedded_checkout") {
        setCardSecret(setup.client_secret);
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
          email: setup.customer_email ?? user?.primaryEmailAddress?.emailAddress ?? undefined,
          onSuccess: () => void afterCardSaved(),
          onCancel: () => setBusy(false),
          onError: (message) => {
            setError(message);
            setBusy(false);
          },
        });
        return;
      }
      console.error("[get-started] card setup answered a hosted page to an in-page request", setup);
      throw new Error("We could not open the card form here. Try again in a moment.");
    } catch (e) {
      console.error("[get-started] card setup failed:", e);
      setError(e instanceof Error ? e.message : "We could not open the card form.");
      setBusy(false);
    }
  }

  // ── The plan's card (billing#568) ──
  // The card is saved through the ordinary card setup billing answers (Revolut widget by
  // default, Stripe's embedded form when the org's card lives there), then the plan starts.
  async function openTrialCheckout() {
    setBusy(true);
    setError(null);
    try {
      await declareRevolut();
      const checkout = await createSubscriptionCheckout({ monthly_amount_cents: monthlyCents, ui_mode: "embedded" });
      const setup: CardSetup | null = checkout.card_setup;
      if (!checkout.card_required || !setup) {
        void afterTrialCardSaved();
        return;
      }
      if (setup.mode === "embedded_checkout") {
        setCardSecret(setup.client_secret);
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
          email: setup.customer_email ?? user?.primaryEmailAddress?.emailAddress ?? undefined,
          onSuccess: () => void afterTrialCardSaved(),
          onCancel: () => setBusy(false),
          onError: (message) => {
            setError(message);
            setBusy(false);
          },
        });
        return;
      }
      console.error("[get-started] subscription checkout answered a hosted page to an in-page request", setup);
      throw new Error("[get-started] subscription checkout: no in-page card form");
    } catch (e) {
      console.error("[get-started] subscription checkout failed:", e);
      setError(subscriptionCheckoutRefusal(e instanceof ApiError && e.status === 409 ? e.body?.code : undefined));
      setBusy(false);
    }
  }

  // Open the plan. The saved card reaches billing through the provider's webhook a
  // moment after the form reports it, so `card_required` is retried, not shown.
  async function afterTrialCardSaved() {
    setCardSecret(null);
    setBusy(true);
    setError(null);
    try {
      let started = false;
      for (let i = 0; i < 12 && !started; i++) {
        try {
          await startSubscription();
          started = true;
        } catch (err) {
          const code = err instanceof ApiError && err.status === 409 ? err.body?.code : undefined;
          if (code === "subscription_exists") started = true;
          else if (code !== "card_required") throw err;
          else await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!started) throw new Error("[get-started] the card was not confirmed in time");
      const read = await getSubscription();
      if (read.payment_mode !== "subscription" || !read.subscription) {
        throw new Error("[get-started] subscription did not start");
      }
    } catch (e) {
      console.error("[get-started] subscription start failed:", e);
      setError("Your card is saved, but your trial could not start yet. Wait a few seconds and press the button again.");
      setBusy(false);
      return;
    }
    posthog.capture("get_started_card_saved", { plan: "subscription" });
    void launch(null);
  }

  async function afterCardSaved() {
    setCardSecret(null);
    setBusy(true);
    setError(null);
    // The saved card reaches billing through the provider's webhook a moment later.
    let acct: BillingAccount | null = null;
    for (let i = 0; i < 12; i++) {
      acct = await getBillingAccount().catch((e) => {
        console.error("[get-started] billing read after card save failed:", e);
        return null;
      });
      if (acct?.has_payment_method) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!acct?.has_payment_method) {
      setError("Your card is still being confirmed. Wait a few seconds and press the button again.");
      setBusy(false);
      return;
    }
    setAccount(acct);
    posthog.capture("get_started_card_saved");
    void launch(acct);
  }

  // ── Launch ──
  // `acct` is null on the plan: it funds itself (billing flipped the mode at start), so
  // no payment mode is written and no top-up is armed.
  async function launch(acct: BillingAccount | null) {
    if (budgetUsd == null || !orgId) return;
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      if (acct) {
        // A card some countries only let us charge with each payment approved cannot top
        // up by itself: that org runs prepaid on its free credit instead.
        const postpaid = acct.auto_reload_supported !== false;
        await setPaymentMode(postpaid ? "postpaid" : "prepaid");
        if (postpaid) await configureAutoTopup(5000, 1000);
      }
      const campaignId = await launchFromPreview(
        { brandId, website, offer, targetAudience, budgetUsd, plan, answered },
        progress.current,
      );
      await defaultSalesRepToAccountEmail(brandId, user?.primaryEmailAddress?.emailAddress);
      const token = await session?.getToken({ skipCache: true });
      if (!token) throw new Error("Your session expired. Sign in again to finish.");
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("We could not finish setting up your account. Try again.");
      await session?.getToken({ skipCache: true });
      posthog.capture("get_started_launched", { budget_usd: budgetUsd, plan: subscription ? "subscription" : "pay_as_you_go" });
      try {
        sessionStorage.removeItem(GET_STARTED_SNAPSHOT_KEY);
      } catch {
        // Nothing to clean up in a tab that never wrote one.
      }
      window.location.assign(v2MissionHref(orgId, brandId, campaignId));
    } catch (e) {
      console.error("[get-started] launch failed:", e);
      setError(e instanceof Error ? e.message : "The launch stopped. Try again.");
      setStage("card");
      setBusy(false);
    }
  }

  const proof = catalogue?.proof ?? null;
  const hotLeads = hotLeadsForCredit(proof?.hotLeads?.medianCostUsd, copy.creditUsd);
  const medianReturn = proof?.medianReturnPerDollar ?? null;

  const urgency =
    stage !== "launching" ? (
      <div className="mb-4 grid gap-2">
        <TrialTimer label={copy.timerLabel} extendedLabel={copy.timerExtendedLabel} />
        <TrialSpots />
      </div>
    ) : null;

  const budgetRow = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="k-label w-24 shrink-0">Daily budget</span>
      <span className="flex items-center gap-1.5">
        <span className="k-fg2 text-[13px]">$</span>
        <input
          className="k-input h-7 w-16 px-2 text-right tabular-nums"
          inputMode="numeric"
          value={budget}
          onChange={(e) => {
            budgetTouched.current = true;
            setBudget(e.target.value);
            setError(null);
          }}
          readOnly={subscription}
          disabled={stage === "launching"}
          aria-label="Daily budget in dollars"
        />
        <span className="k-fg3 text-[12px]">a day</span>
      </span>
      {subscription && <span className="k-chip">Your plan</span>}
      {!subscription && recommendation != null && Number(budget) === recommendation && (
        <span key={recommendation} className="gs-pop k-chip">
          Recommended
        </span>
      )}
      {pricing && recommendation == null && <span className="k-fg3 text-[12px]">Pricing your offer...</span>}
      <span className="k-fg3 w-full text-[12px] leading-5">
        One budget a day for every step of your sales. Replies to your leads come first. The rest finds new leads on your most profitable path.
      </span>
    </div>
  );

  return createPortal(
    <div
      className="v2-root gs-scrim fixed inset-0 z-[60] overflow-y-auto bg-[color-mix(in_oklab,var(--bg-canvas)_35%,transparent)] backdrop-blur-[6px]"
    >
      <button
        type="button"
        aria-label="Close"
        className="k-btn fixed right-3 top-3 z-10 h-8 w-8 justify-center p-0 text-[16px]"
        onClick={onClose}
        disabled={busy || stage === "launching"}
      >
        ×
      </button>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start outreach"
        className="mx-auto grid w-full max-w-[1040px] gap-3 px-3 pb-10 pt-14 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:px-6 md:pt-[6vh]"
      >
        {/* What the $30 is, and what it buys. */}
        <section className="gs-panel k-popover p-5 md:col-start-1">
          {note && <p className="k-fg2 mb-3 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-[13px] leading-5">{note}</p>}
          <p className="k-fg text-[22px] font-semibold leading-7 tracking-tight">
            <CountUp value={copy.creditUsd} format={(n) => `$${Math.round(n)}`} ms={800} /> {copy.creditLine}
          </p>
          <ul className="k-fg2 mt-2.5 grid gap-1 text-[13px] leading-5">
            {[
              `We write to the people in ${audience.name}, one email each.`,
              "We send from our own warmed domains, never yours.",
              "Interested replies land in your inbox.",
            ].map((line, i) => (
              <li key={line} className="gs-in flex gap-2" style={{ animationDelay: `${160 + i * 80}ms` }}>
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          {(hotLeads != null || medianReturn != null) && (
            <>
              <p className="k-fg mt-4 text-[13px] font-medium">{`Here is what your $${copy.creditUsd} gets you`}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {hotLeads != null && (
                  <BuysTile label="Hot leads" note="Replies or visits">
                    <CountUp value={hotLeads} format={(n) => String(Math.round(n))} ms={900} />
                  </BuysTile>
                )}
                {medianReturn != null && (
                  <BuysTile label="Median ROI" note="Of our clients">
                    <CountUp value={medianReturn} format={(n) => formatReturn(n)} ms={900} />
                  </BuysTile>
                )}
              </div>
              {hotLeads != null && proof?.hotLeads && (
                <p className="k-fg3 mt-2 text-[12px] leading-5">
                  From what our clients get at the median. An estimate, not a promise.
                </p>
              )}
            </>
          )}
        </section>

        {/* The form, the one thing to do here: framed in the accent, with its own headline, first on a phone. */}
        <section
          className="gs-panel k-popover gs-glow order-first overflow-hidden p-0 ring-2 ring-[var(--accent)] md:order-none md:col-start-2 md:row-span-3 md:row-start-1"
          style={{ animationDelay: "80ms" }}
        >
          {/* A plain headline, no fill: only the buttons may look clickable (owner 2026-10-01). */}
          <div className="border-b border-[var(--line-subtle)] px-5 py-4">
            <p className="k-fg text-[20px] font-semibold leading-7 tracking-tight">
              <span aria-hidden="true">🎉 </span>
              {copy.formTitle}
            </p>
            <p className="k-fg2 mt-0.5 text-[13px]">{copy.formSub}</p>
            <p className="k-fg3 mt-1.5 text-[12px] font-medium">{BRAND_WHY}</p>
          </div>
          <div className="p-5">
          {/* The scarcity and the steps first, then the buttons under them (owner 2026-10-01). */}
          {urgency}
          <Steps stage={stage} />
          <div key={stage === "code" ? "account" : stage} className="gs-in">
            {(stage === "account" || stage === "code") && !isSignedIn && (
              <>
                {stage === "account" ? (
                  <form className="mt-4 grid gap-3" onSubmit={(e) => void submitAccount(e)}>
                    {/* Two equal choices, same colour (owner 2026-10-01): Google's dark theme, and
                        email in the same dress; the email field opens on its click. */}
                    <button
                      type="button"
                      className="k-cta k-cta-dark w-full justify-center gap-3"
                      onClick={() => void google()}
                      disabled={busy}
                    >
                      <GoogleMark />
                      Continue with Google
                    </button>
                    {!emailOpen ? (
                      <button
                        type="button"
                        className="k-cta k-cta-dark w-full justify-center gap-3"
                        onClick={() => setEmailOpen(true)}
                        disabled={busy}
                      >
                        <EnvelopeIcon className="h-5 w-5" aria-hidden="true" />
                        Continue with Email
                      </button>
                    ) : (
                      <div className="gs-in grid gap-2">
                        <input
                          className="k-input k-cta-input"
                          type="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          aria-label="Work email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="k-cta k-cta-dark w-full justify-center"
                          disabled={busy || !EMAIL_SHAPE.test(email.trim())}
                        >
                          {busy ? (captchaWaiting ? "Waiting for verification" : "Sending your code...") : copy.emailCta}
                        </button>
                      </div>
                    )}
                    <div id="clerk-captcha" />
                    {captchaWaiting && (
                      <p className="gs-in k-fg2 text-[12px]" role="status">
                        Check the box above to finish creating your account.
                      </p>
                    )}
                    <Consent brandName={brandName} checked={consent} onChange={setConsent} />
                    <p className="k-fg3 text-[12px]">
                      Already have an account?{" "}
                      <a className="k-accent-text underline" href="/sign-in">
                        Sign in
                      </a>
                    </p>
                  </form>
                ) : (
                  <form className="mt-4 grid gap-3" onSubmit={(e) => void submitCode(e)}>
                    <p className="k-fg2 text-[13px] leading-5">
                      {`We sent a 6-digit code to `}
                      <span className="k-fg font-medium">{email.trim()}</span>.
                    </p>
                    <label className="grid gap-1">
                      <span className="k-label">Code</span>
                      <input
                        className="k-input k-cta-input tracking-[0.4em] tabular-nums"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={VERIFICATION_CODE_LENGTH}
                        value={code}
                        onChange={(e) => setCode(sanitizeVerificationCode(e.target.value))}
                        autoFocus
                      />
                    </label>
                    <button
                      type="submit"
                      className="k-btn-accent k-cta gs-glow w-full justify-center"
                      disabled={busy || code.length !== VERIFICATION_CODE_LENGTH}
                    >
                      {busy ? "Checking..." : copy.codeCta}
                    </button>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                      <button
                        type="button"
                        className="k-btn-ghost h-6 px-1.5"
                        onClick={() => {
                          setStage("account");
                          setCode("");
                          setError(null);
                          setNotice(null);
                        }}
                        disabled={busy}
                      >
                        Change email
                      </button>
                      <button type="button" className="k-btn-ghost h-6 px-1.5 tabular-nums" onClick={() => void resendCode()} disabled={busy || resendIn > 0}>
                        {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                      </button>
                    </div>
                    {notice && <p className="k-fg2 text-[12px]" role="status">{notice}</p>}
                    <p className="k-fg3 text-[12px] leading-5">No password to remember. Next time, sign in with a code sent to this email.</p>
                  </form>
                )}
              </>
            )}

            {stage === "claim" && (
              <div className="mt-4 grid gap-2">
                <p className="k-fg2 text-[13px]">{claiming ? "Setting up your account..." : "Your account is ready."}</p>
                {claiming && (
                  <span className="block h-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
                    <span className="k-indeterminate block h-full w-1/3 rounded-full bg-[var(--accent)]" />
                  </span>
                )}
              </div>
            )}

            {stage === "card" && !cardSecret && (
              <div className="mt-4 grid gap-3">
                <p className="k-fg text-[13px] font-medium">
                  {account?.has_payment_method && !subscription ? "Your card is on file." : copy.cardTitle}
                </p>
                {(subscription || !account?.has_payment_method) && (
                  <p className="k-fg2 -mt-2 text-[13px] leading-5">{copy.cardNote}</p>
                )}
                {!subscription && <div className="k-inset rounded-lg p-3">{budgetRow}</div>}
                <Consent brandName={brandName} checked={consent} onChange={setConsent} />
                <button type="button" className="k-btn-accent gs-glow h-9 justify-center" onClick={() => void addCard()} disabled={busy}>
                  {busy ? "Opening the card form..." : account?.has_payment_method && !subscription ? "Start outreach" : copy.cardCta}
                </button>
              </div>
            )}

            {stage === "card" && cardSecret && (
              <div className="mt-4 grid gap-2">
                <p className="k-fg text-[13px] font-medium">{copy.cardTitle}</p>
                <EmbeddedCheckoutProvider
                  stripe={getStripe()}
                  options={{ clientSecret: cardSecret, onComplete: () => void (subscription ? afterTrialCardSaved() : afterCardSaved()) }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}

            {stage === "launching" && (
              <div className="mt-4 grid gap-2">
                <p className="k-fg2 text-[13px]">Creating your audiences, funding the campaign and starting it...</p>
                <span className="block h-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
                  <span className="k-indeterminate block h-full w-1/3 rounded-full bg-[var(--accent)]" />
                </span>
              </div>
            )}
          </div>
          {error && (
            <p key={error} className="gs-in mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
              {error}
            </p>
          )}
          </div>
        </section>

        {/* What our clients say, kept sharp while the rest is blurred. */}
        <Testimonials />
      </div>
    </div>,
    document.body,
  );
}

function BuysTile({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="k-inset gs-in rounded-lg px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">{label}</span>
        <span className="k-fg3 truncate text-[11px]">{note}</span>
      </div>
      <p className="k-fg mt-1 text-[22px] font-semibold leading-7 tabular-nums">{children}</p>
    </div>
  );
}



function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function Consent({ brandName, checked, onChange }: { brandName: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-[12px] leading-5">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="k-fg2">
        {`I allow distribute.you to email on behalf of ${brandName} and accept the `}
        <a className="k-accent-text underline" href="https://distribute.you/terms" target="_blank" rel="noreferrer">
          terms
        </a>
        .
      </span>
    </label>
  );
}

function Steps({ stage }: { stage: Stage }) {
  const at = stage === "account" || stage === "code" || stage === "claim" ? 0 : stage === "card" ? 1 : 2;
  const items = ["Account", "Card", "Start"];
  return (
    <div>
      <ol className="flex items-center gap-2" aria-label="Setup">
        {items.map((label, i) => (
          <li key={label} className="flex items-center gap-2" aria-current={i === at ? "step" : undefined}>
            {i > 0 && <span className="h-px w-4 bg-[var(--line)]" />}
            <span className={`inline-flex items-center gap-1.5 text-[12px] ${i === at ? "k-fg font-medium" : i < at ? "k-fg2" : "k-fg3"}`}>
              <span
                key={i < at ? "done" : "todo"}
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] tabular-nums ${
                  i < at ? "gs-pop bg-[var(--bg-strong)] text-white" : i === at ? "bg-[var(--accent)] text-white" : "border border-[var(--line-strong)]"
                }`}
              >
                {i + 1}
              </span>
              {label}
            </span>
          </li>
        ))}
      </ol>
      <span className="mt-3 block h-1 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
        <span className="gs-fill block h-full rounded-full bg-[var(--accent)]" style={{ width: `${((at + 1) / items.length) * 100}%` }} />
      </span>
    </div>
  );
}

/**
 * Real words from real clients, as the homepage states them (owner 2026-10-01: the
 * payment step carries testimonials beside the proof card). Never invented.
 */
const TESTIMONIALS = [
  {
    name: "Christian Lemke",
    role: "Google Ads expert, Maggie M.",
    photo: "/start/christian-lemke.jpg",
    quote: "It was incredibly fast to launch a campaign. I just entered my URL, the platform identified the right audience and handled the outreach.",
  },
  {
    name: "Katherine Fleishman",
    role: "Marketing expert, 20+ years",
    photo: "/start/katherine-fleishman.jpeg",
    quote: "Excellent click-through rate. I can literally see everything at a glance.",
  },
  {
    name: "Andrew Becker",
    role: "Founder, voozaa.app",
    photo: "/start/andrew-becker.jpg",
    quote: "Best thing I liked is the depth to which it personalizes outreach. Something I always wished I could do better at scale.",
  },
] as const;

function Testimonials() {
  return (
    <section className="gs-panel k-popover grid gap-3 p-4 md:col-start-1">
      {TESTIMONIALS.map((t) => (
        <figure key={t.name} className="grid gap-1.5">
          <span className="text-[13px] tracking-[2px] text-[var(--data-amber)]" aria-label="5 out of 5 stars">
            ★★★★★
          </span>
          <blockquote className="k-fg text-[13px] leading-5">{t.quote}</blockquote>
          <figcaption className="flex items-center gap-2">
            <img src={t.photo} alt="" className="h-6 w-6 rounded-full object-cover" />
            <span className="text-[12px]">
              <span className="k-fg font-medium">{t.name}</span>
              <span className="k-fg3">{` · ${t.role}`}</span>
            </span>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
