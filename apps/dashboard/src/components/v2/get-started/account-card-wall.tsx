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

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth, useSession, useUser } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import posthog from "posthog-js";
import {
  configureAutoTopup,
  createEmbeddedCardSetup,
  getBillingAccount,
  setPaymentMode,
  type BillingAccount,
} from "@/lib/api";
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
  WALL_FREE_CREDIT_USD,
  hotLeadsForCredit,
  nextSlide,
  parseDailyBudget,
  type GetStartedEmail,
  totalDailyUsd,
  type GetStartedAudience,
  type GetStartedOffer,
  type GetStartedOutcome,
} from "@/lib/v2/get-started";
import { proofCardsFor, shuffleWithSeed, type ProofCard } from "@/lib/start-proof";
import { formatReturn, useStartCatalogue } from "@/components/start/start-picks";
import { EMPTY_PROGRESS, coldEmailLegFor, launchFromPreview, recommendedBudgetForPreview, type LaunchProgress } from "./launch";
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
  note = null,
  email: writtenEmail,
  floorUsd,
  recommendedUsd,
  budgetChosen = false,
  outcome,
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
  /** Why the wall opened, when it was not the visitor's own click (the free emails ran out). */
  note?: string | null;
  /** The email the preview wrote, or null when none was written. */
  email: GetStartedEmail | null;
  floorUsd: number;
  recommendedUsd: number | null;
  /** The budget was typed by the person earlier (restored after a round trip): a price that lands later must not replace it. */
  budgetChosen?: boolean;
  /** What the visitor buys: one campaign (visits) or two (meetings), each at the daily budget. */
  outcome: GetStartedOutcome;
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

  const [stage, setStage] = useState<Stage>("account");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  // The price read once the brand has an owner (and therefore an offer) wins over the
  // one the preview could read signed out, which is none for a brand with no offer yet.
  const [pricedUsd, setPricedUsd] = useState<number | null>(null);
  const [pricing, setPricing] = useState(false);
  const recommendation = pricedUsd ?? recommendedUsd;
  // No price held yet: the channel's own floor, the smallest budget it runs on.
  const [budget, setBudget] = useState(String(recommendation ?? Math.ceil(floorUsd)));
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
  const budgetTouched = useRef(budgetChosen);
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
        recommendedBudgetForPreview(brandId, offer.offerId, floorUsd, coldEmailLegFor(outcome))
          .then((usd) => setPricedUsd(usd))
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

  const parsedBudget = parseDailyBudget(budget, floorUsd);
  const budgetUsd = "usd" in parsedBudget ? parsedBudget.usd : null;

  function checkReady(): boolean {
    if (!consent) {
      setError(`Tick the box to let us email on behalf of ${brandName}.`);
      return false;
    }
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
    if (!checkReady()) return;
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
    if (!checkReady()) return;
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
  async function launch(acct: BillingAccount) {
    if (budgetUsd == null || !orgId) return;
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      // A card some countries only let us charge with each payment approved cannot top
      // up by itself: that org runs prepaid on its free credit instead.
      const postpaid = acct.auto_reload_supported !== false;
      await setPaymentMode(postpaid ? "postpaid" : "prepaid");
      if (postpaid) await configureAutoTopup(5000, 1000);
      const campaignId = await launchFromPreview(
        { brandId, website, offer, audienceId: audience.audienceId, budgetUsd, outcome, answered },
        progress.current,
      );
      const token = await session?.getToken({ skipCache: true });
      if (!token) throw new Error("Your session expired. Sign in again to finish.");
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("We could not finish setting up your account. Try again.");
      await session?.getToken({ skipCache: true });
      posthog.capture("get_started_launched", { budget_usd: budgetUsd });
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
  const hotLeads = hotLeadsForCredit(proof?.hotLeads?.medianCostUsd);
  const medianReturn = proof?.medianReturnPerDollar ?? null;

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
          disabled={stage === "launching"}
          aria-label="Daily budget in dollars"
        />
        <span className="k-fg3 text-[12px]">{outcome === "meetings" ? "a day on each" : "a day"}</span>
      </span>
      {recommendation != null && Number(budget) === recommendation && (
        <span key={recommendation} className="gs-pop k-chip">
          Recommended
        </span>
      )}
      {pricing && recommendation == null && <span className="k-fg3 text-[12px]">Pricing your offer...</span>}
      {outcome === "meetings" && budgetUsd != null && (
        <span className="k-fg3 w-full text-[12px] leading-5">
          {`Two campaigns run: cold email gets the replies, meeting booking turns them into meetings. $${totalDailyUsd(outcome, budgetUsd)} a day in total.`}
        </span>
      )}
    </div>
  );

  return createPortal(
    <div
      className="v2-root gs-scrim fixed inset-0 z-[60] overflow-y-auto bg-[color-mix(in_oklab,var(--bg-canvas)_35%,transparent)] backdrop-blur-[6px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy && stage !== "launching") onClose();
      }}
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
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !busy && stage !== "launching") onClose();
        }}
      >
        {/* What the $30 is, and what it buys. */}
        <section className="gs-panel k-popover p-5 md:col-start-1">
          {note && <p className="k-fg2 mb-3 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-[13px] leading-5">{note}</p>}
          <p className="k-fg text-[22px] font-semibold leading-7 tracking-tight">
            <CountUp value={WALL_FREE_CREDIT_USD} format={(n) => `$${Math.round(n)}`} ms={800} /> free credit
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
              <p className="k-fg mt-4 text-[13px] font-medium">{`Here is what your $${WALL_FREE_CREDIT_USD} gets you`}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {hotLeads != null && (
                  <BuysTile label="Hot leads" note="Replies or visits">
                    ~<CountUp value={hotLeads} format={(n) => String(Math.round(n))} ms={900} />
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
                  {`At the median our clients pay, $${proof.hotLeads.medianCostUsd.toFixed(2)} per hot lead. An estimate, not a promise.`}
                </p>
              )}
            </>
          )}
        </section>

        {/* The form. On a phone it comes right after the $30. */}
        <section className="gs-panel k-popover p-5 md:col-start-2 md:row-span-3 md:row-start-1" style={{ animationDelay: "80ms" }}>
          {stage !== "launching" && (
            <div className="mb-4 grid gap-2">
              <TrialTimer />
              <TrialSpots />
            </div>
          )}
          <Steps stage={stage} />
          <div key={stage === "code" ? "account" : stage} className="gs-in">
            {(stage === "account" || stage === "code") && !isSignedIn && (
              <>
                {stage === "account" ? (
                  <form className="mt-4 grid gap-3" onSubmit={(e) => void submitAccount(e)}>
                    <label className="grid gap-1">
                      <span className="k-label">Work email</span>
                      <input
                        className="k-input h-9 px-2.5"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <div className="k-inset grid gap-2 rounded-lg p-3">
                      {budgetRow}
                      <p className="k-fg3 text-[12px] leading-5">
                        {`You will not be charged yet. We spend your $${WALL_FREE_CREDIT_USD} first, then your card pays what the campaign spends, never more than your daily budget. Pause anytime.`}
                      </p>
                    </div>
                    <Consent brandName={brandName} checked={consent} onChange={setConsent} />
                    <div id="clerk-captcha" />
                    {captchaWaiting && (
                      <p className="gs-in k-fg2 text-[12px]" role="status">
                        Check the box above to finish creating your account.
                      </p>
                    )}
                    <button
                      type="submit"
                      className="k-btn-accent gs-glow h-9 justify-center"
                      disabled={busy || !EMAIL_SHAPE.test(email.trim())}
                    >
                      {busy ? (captchaWaiting ? "Waiting for verification" : "Sending your code...") : "Email me a code"}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="h-px flex-1 bg-[var(--line-subtle)]" />
                      <span className="k-fg3 text-[12px]">or</span>
                      <span className="h-px flex-1 bg-[var(--line-subtle)]" />
                    </div>
                    <button type="button" className="k-btn h-9 justify-center gap-2" onClick={() => void google()} disabled={busy}>
                      <GoogleMark />
                      Continue with Google
                    </button>
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
                        className="k-input h-10 px-2.5 text-[18px] tracking-[0.4em] tabular-nums"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={VERIFICATION_CODE_LENGTH}
                        value={code}
                        onChange={(e) => setCode(sanitizeVerificationCode(e.target.value))}
                        autoFocus
                      />
                    </label>
                    <button type="submit" className="k-btn-accent h-9 justify-center" disabled={busy || code.length !== VERIFICATION_CODE_LENGTH}>
                      {busy ? "Checking..." : "Verify and add card"}
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
                  {account?.has_payment_method ? "Your card is on file." : "You will not be charged yet"}
                </p>
                {!account?.has_payment_method && (
                  <p className="k-fg2 -mt-2 text-[13px] leading-5">
                    {`The card only confirms you are real. Once your $${WALL_FREE_CREDIT_USD} runs out, it pays what the campaign spends, never more than your daily budget.`}
                  </p>
                )}
                <div className="k-inset rounded-lg p-3">{budgetRow}</div>
                <Consent brandName={brandName} checked={consent} onChange={setConsent} />
                <button type="button" className="k-btn-accent gs-glow h-9 justify-center" onClick={() => void addCard()} disabled={busy}>
                  {busy ? "Opening the card form..." : account?.has_payment_method ? "Start outreach" : "Add card and start"}
                </button>
              </div>
            )}

            {stage === "card" && cardSecret && (
              <div className="mt-4 grid gap-2">
                <p className="k-fg text-[13px] font-medium">You will not be charged yet</p>
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: cardSecret, onComplete: () => void afterCardSaved() }}>
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
        </section>

        {/* The product's proof, kept sharp while the rest is blurred. */}
        {writtenEmail && <EmailCard mail={writtenEmail} />}

        <ClientCarousel cards={proof ? proofCardsFor(proof.showcase) : []} />
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

function EmailCard({ mail }: { mail: GetStartedEmail }) {
  const to = [[mail.recipient.firstName, mail.recipient.lastName].filter(Boolean).join(" "), mail.recipient.title]
    .filter(Boolean)
    .join(", ");
  return (
    <section className="gs-panel k-popover overflow-hidden md:col-start-1" style={{ animationDelay: "160ms" }} aria-label="Your first email">
      <div className="flex items-center gap-2 border-b border-[var(--line-subtle)] px-4 py-2.5">
        <span className="k-label">Your first email</span>
        <span className="k-fg3 ml-auto flex items-center gap-1.5 text-[12px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--run)]" aria-hidden="true" />
          Goes out when you start
        </span>
      </div>
      <div className="flex gap-3 border-b border-[var(--line-subtle)] px-4 py-2 text-[13px]">
        <span className="k-label w-14 shrink-0 pt-0.5">To</span>
        <span className="k-fg2 min-w-0 truncate">
          {to}
          {mail.recipient.companyName ? ` at ${mail.recipient.companyName}` : ""}
        </span>
      </div>
      <div className="flex gap-3 border-b border-[var(--line-subtle)] px-4 py-2 text-[13px]">
        <span className="k-label w-14 shrink-0 pt-0.5">Subject</span>
        <span className="k-fg min-w-0 font-medium">{mail.subject}</span>
      </div>
      <p className="k-scroll k-fg2 max-h-[180px] overflow-y-auto whitespace-pre-line px-4 py-3 text-[13px] leading-6">{mail.bodyText}</p>
    </section>
  );
}

/**
 * One named client at a time, turning every few seconds. Only the clients who agreed
 * to be shown (`proofCardsFor` draws nothing for anyone else), with their own served
 * figures. Hover or focus holds it; reduced motion holds it on the first card.
 */
function ClientCarousel({ cards }: { cards: ProofCard[] }) {
  const reduced = usePrefersReducedMotion();
  const [seed] = useState(() => Math.random());
  const ordered = shuffleWithSeed(cards, seed);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const count = ordered.length;
  useEffect(() => {
    if (reduced || held || count < 2) return;
    const id = setTimeout(() => setI((cur) => nextSlide(cur, count)), SLIDE_MS);
    return () => clearTimeout(id);
  }, [i, reduced, held, count]);
  if (count === 0) return null;
  const c = ordered[Math.min(i, count - 1)];
  const deepest = c.counts.length > 1 ? c.counts[c.counts.length - 1] : null;
  const tiles: { label: string; value: string }[] = [
    { label: "Return", value: formatReturn(c.returnPerDollar) },
    ...(deepest ? [{ label: deepest.label, value: deepest.peopleReached.toLocaleString("en-US") }] : []),
    ...(c.firstStep?.costPerReachUsd != null
      ? [{ label: `Cost per ${c.firstStep.label.toLowerCase()}`, value: `$${Math.round(c.firstStep.costPerReachUsd).toLocaleString("en-US")}` }]
      : []),
  ];
  return (
    <section
      className="gs-panel k-popover p-5 md:col-start-1"
      style={{ animationDelay: "240ms" }}
      aria-label="Our clients"
      aria-roledescription="carousel"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div key={c.id} className="gs-in" aria-live="polite">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.person.portrait} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="k-fg truncate text-[14px] font-medium">{c.person.name}</p>
            <p className="k-fg3 truncate text-[12px]">{c.person.role}</p>
          </div>
        </div>
        <p className="k-label mt-4">Results</p>
        <div className={`mt-2 grid gap-2 ${tiles.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {tiles.map((t) => (
            <div key={t.label} className="k-inset min-w-0 rounded-lg px-2.5 py-2">
              <p className="k-fg3 truncate text-[11px]">{t.label}</p>
              <p className="k-fg mt-0.5 text-[16px] font-semibold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </div>
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1">
          {ordered.map((x, n) => (
            <button
              key={x.id}
              type="button"
              aria-label={`Show ${x.person.name}`}
              aria-current={n === i ? "true" : undefined}
              className="flex h-6 w-6 items-center justify-center"
              onClick={() => setI(n)}
            >
              <span className={`block h-1.5 rounded-full transition-[width,background-color] duration-300 ${n === i ? "w-4 bg-[var(--fg-2)]" : "w-1.5 bg-[var(--line-strong)]"}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
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
