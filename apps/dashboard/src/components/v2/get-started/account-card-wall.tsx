"use client";

/**
 * The one wall of `/get-started`: the account and the credit, on ONE screen, opened as a
 * layer OVER the results the founder just watched (blurred behind it), the way Explee
 * opens its paywall. The product stays in view while they pay.
 *
 * Left: the $100 match, what it buys (a SERVED fleet price, or nothing), the email we
 * wrote kept sharp ("this one goes out when you start"), and a rotating card per named
 * client who agreed to be shown. Right: the countdown and spots strips (owner-decided,
 * copied from Explee), then the form.
 *
 * The form walks four states in place, never navigating away (the Google button is the
 * one exception, and it comes straight back here with `?resume=1`):
 *   1. account  — work email, then the emailed 6-digit code (no password to invent), or Google;
 *                 an email or Google account that ALREADY exists signs in instead, and the
 *                 brand gets a NEW org of its own (`returning`), never the org they last used;
 *   2. claim    — the anonymous org they built is re-pointed at the account they just
 *                 made (`/api/anon/claim`, the same hinge `/onboarding/claim` runs);
 *   2b. phone   — their phone number, required (owner 2026-10-04: every signup leaves
 *                 one, even if they stop before the card), stored on the Clerk user;
 *   3. card     — prepaid credit (owner 2026-10-06, no free trial): an amount of at
 *                 least $100 and an optional automatic reload, paid in the same column
 *                 (Revolut widget or Stripe's embedded form); we match the first $100.
 *                 A visitor the homepage A/B test put in the `subscription` arm (owner
 *                 2026-10-10) saves a card instead and starts billing's $99/month plan
 *                 with its 3-day trial: no amount, no match, no reload. The `postpaid`
 *                 arm (owner 2026-10-13) saves a card, is charged nothing, and the org is
 *                 made post-paid. On every arm, a saved card billing says automatic
 *                 charges may not reach (prepaid, India) opens a warning: another card,
 *                 or continue anyway (post-paid: switch to prepaid, no way past);
 *   4. launch   — the campaign set at the "Your campaign" step starts, its caps first
 *                 (`launch.ts`), and the page lands on it.
 */

import { defaultSalesRepToAccountEmail } from "@/lib/sales-rep-default";
import { useEffect, useRef, useState } from "react";
import { BRAND_WHY } from "@/lib/brand-why";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import { useAuth, useOrganizationList, useSession, useUser } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import posthog from "posthog-js";
import {
  ApiError,
  createEmbeddedCardSetup,
  createSubscriptionCheckout,
  getBillingAccount,
  getSavedCardFacts,
  getSubscription,
  sendAuthNotification,
  savePhoneNumber,
  setMonthlyChargeLimit,
  setPaymentMode,
  startSubscription,
  type BillingAccount,
  type CardSetup,
} from "@/lib/api";
import { PREPAID_CARD_TRIAL_REFUSAL, lpVariant, offerArm, pickedPlanCents, subscriptionCheckoutRefusal, type OfferArm } from "@/lib/subscription-plan";
import { cardRiskCopy, postpaidRefusalFacts, type CardFacts, type CardRiskCopy } from "@/lib/v2/card-risk";
import { CardRiskNotice } from "./card-risk-notice";
import { getStripe } from "@/lib/stripe";
import {
  authFailureProps,
  clerkErrorCode,
  clerkErrorMessage,
  sanitizeVerificationCode,
  VERIFICATION_CODE_LENGTH,
} from "@/lib/clerk-error";
import { v2CampaignHref } from "@/lib/v2/routes";
import {
  GET_STARTED_SNAPSHOT_KEY,
  matchNote,
  nextSlide,
  topupCta,
  type GetStartedEmail,
  type GetStartedAudience,
  type CampaignOutlook,
  type GetStartedOffer,
  wallCopy,
} from "@/lib/v2/get-started";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { requiredPhoneProblem } from "@/lib/phone-syntax";
import type { PhoneValue } from "@/components/onboarding/phone-input";
import { PhoneField, defaultPhoneCountry } from "./phone-field";
import { EMPTY_PROGRESS, launchFromPreview, type LaunchProgress } from "./launch";
import type { SignupLaunchPlan } from "@/lib/v2/signup-campaign";
import { PrepaidTopup, type TopupChoice } from "./prepaid-topup";
import { SpendConsent, allTicked } from "./spend-consent";
import { consentRecord, spendConsentLines, type PaymentConsentRecord } from "@/lib/v2/spend-consent";
import { monthlyLimitToSave } from "@/lib/v2/monthly-limit";
import { payTopup, settleTopup } from "./pay-topup";
import { pingOwner } from "@/lib/owner-ping-client";
import { hostOf as pingHostOf, websiteUrl as pingWebsiteUrl } from "@/lib/v2/get-started";
import { CountUp, usePrefersReducedMotion } from "./motion";
import { TrialSpots, TrialTimer } from "./urgency";
import { WALL_OPEN_CLASS } from "./view-transition";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** How long a sign-up may wait on the bot check before we say a box needs ticking. */
const CAPTCHA_PROMPT_DELAY_MS = 2500;
const RESEND_COOLDOWN_SECONDS = 30;
const SLIDE_MS = 6000;
/** Set on the way back from Google when Clerk signed an EXISTING account in. */
const RETURNING_PARAM = "returning";
const CONSENT_KEY_PREFIX = "get-started-consent:";

type Stage = "account" | "code" | "claim" | "phone" | "card" | "launching";

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
  plan,
  monthlyLimit,
  outlook,
  answered,
  ipCountry = null,
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
  /** The campaign set at the "Your campaign" step (the funnels and their caps). */
  plan: SignupLaunchPlan;
  /** "Never charge me more than $X a month" as typed at the campaign step; null = the arm's prefill. */
  monthlyLimit: string | null;
  /** The served figures of the campaign picked: what the match buys is read off it. */
  outlook: CampaignOutlook | null;
  /** The offer points and give lists were answered in the preview (and saved). */
  answered: boolean;
  /** The visitor's country from their connection (`cf-ipcountry`), for the phone's default. */
  ipCountry?: string | null;
  onClose: () => void;
}) {
  const { isLoaded: authLoaded, isSignedIn, orgId } = useAuth();
  const { session } = useSession();
  const { user } = useUser();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { createOrganization, setActive: setActiveOrg } = useOrganizationList();

  // The homepage A/B arm (owner 2026-10-13, three arms): `lp_variant=subscription` is sold
  // the $99/month plan with its 3-day trial, `postpaid` saves a card and pays after the
  // spend, everyone else the prepaid credit.
  const [arm] = useState(() => {
    const cookie = document.cookie;
    return { offer: offerArm(cookie), variant: lpVariant(cookie), monthlyCents: pickedPlanCents(cookie) };
  });
  // The offer sold on this wall: the arm's, until a refused card moves post-paid to prepaid.
  const [sold, setSoldState] = useState<OfferArm>(arm.offer);
  const soldRef = useRef<OfferArm>(arm.offer);
  function setSold(next: OfferArm) {
    soldRef.current = next;
    setSoldState(next);
  }
  const isPlan = sold === "subscription";
  const copy = wallCopy(isPlan ? Math.round(arm.monthlyCents / 100) : null, sold === "postpaid");
  // The plan's statements before the trial starts (owner 2026-10-11); prepaid ticks
  // its own inside `PrepaidTopup`, where the amount they name is picked.
  const [planTicked, setPlanTicked] = useState([false, false]);
  // The plan's boxes as ticked at the click, sent with the card form and the plan start.
  const planConsentRecord = useRef<PaymentConsentRecord | null>(null);
  // The plan's monthly limit (validated at the campaign step), named in the ladder box.
  const planLimit = monthlyLimitToSave(monthlyLimit, { kind: "plan", monthlyUsd: Math.round(arm.monthlyCents / 100) });
  const planConsent = spendConsentLines({
    arm: { kind: "plan", monthlyUsd: Math.round(arm.monthlyCents / 100), ...("usd" in planLimit ? { limitUsd: planLimit.usd } : {}) },
  });
  // Post-paid's boxes (owner 2026-10-13): nothing today, charged on spend steps, the terms.
  const postpaidConsent = spendConsentLines({ arm: { kind: "postpaid" } });
  const [postpaidTicked, setPostpaidTicked] = useState([false, false]);
  // The card post-paid runs on is saved and checked; post-paid itself is armed.
  const postpaidCardSaved = useRef(false);
  const postpaidArmed = useRef(false);
  // A saved card automatic charges may not reach (billing's verdict): the warning is up.
  const [cardRisk, setCardRisk] = useState<CardFacts | null>(null);
  const knownCard = useRef<CardFacts | null>(null);
  // What a card saved in Stripe's embedded form goes on to (the plain card save).
  const cardSaved = useRef<(() => void) | null>(null);

  const [stage, setStage] = useState<Stage>("account");
  const [email, setEmail] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [code, setCode] = useState("");
  // The consent is asked once (owner 2026-10-06): ticked before the Google round trip,
  // it survives the round trip (the wall mounts again) and is not asked at the credit step.
  const consentKey = `${CONSENT_KEY_PREFIX}${brandId}`;
  const [consentBefore] = useState(() => {
    try {
      return localStorage.getItem(consentKey) === "1";
    } catch {
      return false;
    }
  });
  const [consent, setConsentState] = useState(consentBefore);
  const consentGiven = useRef(consentBefore);
  function setConsent(v: boolean) {
    setConsentState(v);
    try {
      if (v) localStorage.setItem(consentKey, "1");
      else localStorage.removeItem(consentKey);
    } catch (e) {
      console.error("[get-started] consent not remembered:", e);
    }
  }
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
  const [phone, setPhone] = useState<PhoneValue>(() => {
    const c = defaultPhoneCountry(ipCountry, navigator.language);
    return { countryCode: c.code, dialCode: c.dial, national: "" };
  });
  // The reason shows once they leave the field or press Continue, never mid-typing.
  const [phoneProblemShown, setPhoneProblemShown] = useState(false);

  const claimed = useRef(false);
  // The account already existed (Google came back through the sign-in branch, or the
  // email was taken and they proved it with a code). Their session sits on the org they
  // last used, and claiming into THAT org would be refused (it is somebody's) or, worse,
  // mix this brand into another company. So the brand gets a fresh org first.
  const [returning, setReturning] = useState(
    () => new URLSearchParams(window.location.search).get(RETURNING_PARAM) === "1",
  );
  // The email code proves a sign-IN rather than a sign-up when the email was taken.
  const [codeFor, setCodeFor] = useState<"signup" | "signin">("signup");
  const [signInEmailId, setSignInEmailId] = useState<string | null>(null);
  const [secondFactor, setSecondFactor] = useState(false);
  // The org made for a returning account: the claim waits until the session is on it.
  const freshOrg = useRef<"creating" | string | null>(null);
  const progress = useRef<LaunchProgress>({ ...EMPTY_PROGRESS, caps: {}, started: {}, campaignIds: {} });
  // A payment the form reported: pressing the button again re-checks it, never pays twice.
  const [paid, setPaid] = useState<{ creditedBefore: number; reload: TopupChoice["reload"] } | null>(null);
  // Stripe's embedded form reports through its provider: what it was opened for waits here.
  const pendingReload = useRef<{ creditedBefore: number; reload: TopupChoice["reload"] } | null>(null);
  // The plan already started (a retry after a failed launch must not start it twice).
  const planStarted = useRef(false);

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
    if (!authLoaded || !isSignedIn || claimed.current) return;
    if (returning) {
      if (freshOrg.current === null) {
        freshOrg.current = "creating";
        setStage("claim");
        void (async () => {
          setClaiming(true);
          setError(null);
          try {
            if (!createOrganization || !setActiveOrg) throw new Error("Your session is still loading. Try again in a moment.");
            const org = await createOrganization({ name: brandName });
            posthog.capture("get_started_returning_org_created", { org_id: org.id });
            await setActiveOrg({ organization: org.id });
            freshOrg.current = org.id;
          } catch (e) {
            console.error("[get-started] new org for a returning account failed:", e);
            freshOrg.current = null;
            setClaiming(false);
            setError(e instanceof Error ? e.message : "We could not set up a new organization. Try again.");
          }
        })();
        return;
      }
      // Still creating, or Clerk has not moved the session onto the new org yet.
      if (orgId !== freshOrg.current) return;
    } else if (!orgId) return;
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
        setStage("phone");
      } catch (e) {
        claimed.current = false;
        setError(e instanceof Error ? e.message : "We could not finish setting up your account.");
      } finally {
        setClaiming(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn, orgId, session, returning, createOrganization, setActiveOrg]);

  function checkReady(): boolean {
    if (!consent) {
      setError(`Tick the box to let us email on behalf of ${brandName}.`);
      return false;
    }
    consentGiven.current = true;
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
      if (clerkErrorCode(err) === "form_identifier_exists") {
        // They already have an account: prove it with a code and keep going here.
        clearTimeout(waiting);
        setCaptchaWaiting(false);
        await startSignInCode();
        return;
      }
      posthog.capture("get_started_signup_failed", authFailureProps(err, { stage: "create" }));
      console.error("[get-started] sign up failed:", err);
      setError(clerkErrorMessage(err));
    } finally {
      clearTimeout(waiting);
      setCaptchaWaiting(false);
      setBusy(false);
    }
  }

  /** An existing account: a sign-in code to the same address, same screen. */
  async function startSignInCode() {
    if (!signInLoaded || !signIn) {
      setError("Your session is still loading. Try again in a moment.");
      return;
    }
    try {
      posthog.capture("get_started_signin_email_started");
      const created = await signIn.create({ identifier: email.trim() });
      const factor = created.supportedFirstFactors?.find(
        (f): f is Extract<typeof f, { strategy: "email_code" }> => f.strategy === "email_code",
      );
      if (!factor) throw new Error("This account cannot get a sign-in code. Use the Google button.");
      await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
      setSignInEmailId(factor.emailAddressId);
      setSecondFactor(false);
      setCodeFor("signin");
      setNotice("You already have an account. We sent a sign-in code.");
      setStage("code");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      posthog.capture("get_started_signin_failed", authFailureProps(err, { stage: "create" }));
      console.error("[get-started] sign in failed:", err);
      setError(err instanceof Error && !("errors" in (err as object)) ? err.message : clerkErrorMessage(err));
    }
  }

  async function submitSignInCode() {
    if (!signIn || !setSignInActive) return;
    const result = secondFactor
      ? await signIn.attemptSecondFactor({ strategy: "email_code", code })
      : await signIn.attemptFirstFactor({ strategy: "email_code", code });
    if (result.status === "needs_second_factor") {
      await signIn.prepareSecondFactor({ strategy: "email_code" });
      setSecondFactor(true);
      setCode("");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setNotice(`One more code sent to ${email.trim()}.`);
      return;
    }
    if (result.status !== "complete") {
      posthog.capture("get_started_signin_incomplete", { status: result.status ?? "unknown" });
      throw new Error(`We could not sign you in (${result.status}). Use the Google button or try again.`);
    }
    setReturning(true);
    await setSignInActive({ session: result.createdSessionId });
    posthog.capture("get_started_signin_verified");
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (codeFor === "signin") {
      if (busy) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await submitSignInCode();
      } catch (err) {
        posthog.capture("get_started_signin_failed", authFailureProps(err, { stage: "verify" }));
        console.error("[get-started] sign-in code failed:", err);
        setError(err instanceof Error && !("errors" in (err as object)) ? err.message : clerkErrorMessage(err));
      } finally {
        setBusy(false);
      }
      return;
    }
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
    if (busy || resendIn > 0) return;
    if (codeFor === "signup" && (!signUpLoaded || !signUp)) return;
    if (codeFor === "signin" && !signIn) return;
    setError(null);
    try {
      if (codeFor === "signin" && signIn) {
        if (secondFactor) await signIn.prepareSecondFactor({ strategy: "email_code" });
        else if (signInEmailId) await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId: signInEmailId });
        else throw new Error("Start again with your email.");
      } else await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
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
      // Its own callback: an EXISTING Google account comes back through Clerk's sign-in
      // branch, which ignores `redirectUrlComplete` and used to land on the dashboard,
      // leaving the walk unclaimed and unpaid.
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback/get-started",
        redirectUrlComplete: "/get-started?resume=1",
      });
    } catch (err) {
      console.error("[get-started] google sign up failed:", err);
      setError(clerkErrorMessage(err));
      setBusy(false);
    }
  }

  // ── Phone ──
  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setPhoneProblemShown(true);
    if (requiredPhoneProblem(phone)) return;
    setBusy(true);
    setError(null);
    try {
      await savePhoneNumber(phone);
      posthog.capture("get_started_phone_saved", { country: phone.countryCode });
      setStage("card");
    } catch (err) {
      console.error("[get-started] phone save failed:", err);
      setError("We could not save your number. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // ── Credit ──
  async function declareRevolut() {
    const token = await session?.getToken({ skipCache: true });
    if (!token) throw new Error("Your session expired. Sign in again to finish.");
    const res = await fetch("/api/orgs/revolut", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("We could not prepare the card form. Try again.");
  }

  // The monthly limit is saved to billing before any charge (owner 2026-10-12).
  async function saveMonthlyLimit(usd: number) {
    try {
      await setMonthlyChargeLimit(usd * 100);
    } catch (e) {
      console.error("[get-started] monthly limit not saved:", e);
      throw new Error("We could not save your monthly limit. Try again.");
    }
  }

  async function pay(choice: TopupChoice) {
    if (busy || !checkReady()) return;
    if (paid) {
      void afterPaid(paid);
      return;
    }
    // The monthly limit follows the top-up while untouched (3x); a typed one must let it through.
    const limit = monthlyLimitToSave(monthlyLimit, { kind: "prepaid", topupUsd: choice.topupUsd });
    if ("problem" in limit) {
      setError(limit.problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveMonthlyLimit(limit.usd);
      await declareRevolut();
      const started = await payTopup({
        amountUsd: choice.topupUsd,
        consent: choice.consent,
        // The account this wall just created is new: prepaid is its first mode.
        setPrepaid: true,
        name: user?.fullName ?? undefined,
        email: user?.primaryEmailAddress?.emailAddress ?? undefined,
        onPaid: (creditedBefore) => void afterPaid({ creditedBefore, reload: choice.reload }),
        onCancel: () => setBusy(false),
        onError: (message) => {
          setError(message);
          setBusy(false);
        },
      });
      posthog.capture("get_started_topup_opened", { topup_usd: choice.topupUsd, reload: choice.reload !== null });
      if (started.clientSecret) {
        pendingReload.current = { creditedBefore: started.creditedBefore, reload: choice.reload };
        setCardSecret(started.clientSecret);
        setBusy(false);
      }
    } catch (e) {
      console.error("[get-started] top-up failed to open:", e);
      setError(e instanceof Error ? e.message : "We could not open the card form.");
      setBusy(false);
    }
  }

  // The credit reaches billing through the provider's webhook a moment after the form
  // reports the payment; then the automatic reload is armed when asked, then the launch.
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
    posthog.capture("get_started_card_saved", { plan: "prepaid", lp_variant: arm.variant });
    if (!(await cardIsFine(null))) return;
    void launch();
  }

  // ── Card and plan (the `subscription` arm) ──
  function startTrial() {
    if (busy || !allTicked(planTicked) || !checkReady()) return;
    planConsentRecord.current = consentRecord(planConsent, new Date(), navigator.userAgent);
    if (planStarted.current) {
      void launch();
      return;
    }
    void openTrialCheckout();
  }

  // The card is saved through the ordinary card setup billing answers (Revolut widget by
  // default, Stripe's embedded form when the org's card lives there), then the plan starts.
  async function openTrialCheckout() {
    if ("problem" in planLimit) {
      setError(planLimit.problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveMonthlyLimit(planLimit.usd);
      await declareRevolut();
      const checkout = await createSubscriptionCheckout({ monthly_amount_cents: arm.monthlyCents, ui_mode: "embedded", consent: planConsentRecord.current ?? undefined });
      posthog.capture("get_started_trial_opened", { monthly_usd: Math.round(arm.monthlyCents / 100), lp_variant: arm.variant });
      const setup: CardSetup | null = checkout.card_setup;
      // The card on file is prepaid: say why the form asks for another card.
      if (checkout.card_refused_reason === "prepaid_card") setError(PREPAID_CARD_TRIAL_REFUSAL);
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
  async function afterTrialCardSaved(checked = false) {
    setCardSecret(null);
    setBusy(true);
    setError(null);
    if (!checked && !(await cardIsFine(null))) return;
    try {
      let started = false;
      for (let i = 0; i < 12 && !started; i++) {
        try {
          await startSubscription(planConsentRecord.current ?? undefined);
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
      planStarted.current = true;
    } catch (e) {
      console.error("[get-started] subscription start failed:", e);
      const code = e instanceof ApiError && e.status === 409 ? e.body?.code : undefined;
      setError(
        code === "prepaid_card_trial_refused"
          ? PREPAID_CARD_TRIAL_REFUSAL
          : "Your card is saved, but your trial could not start yet. Wait a few seconds and press the button again.",
      );
      setBusy(false);
      return;
    }
    sendAuthNotification("first_payment").catch((e) => console.error("[get-started] first_payment email failed:", e));
    pingOwner({ event: "trial", domain: website ? pingHostOf(pingWebsiteUrl(website)) : null, amountUsd: Math.round(arm.monthlyCents / 100) });
    posthog.capture("get_started_card_saved", { plan: "subscription", lp_variant: arm.variant });
    void launch();
  }

  // ── Post-paid (the `postpaid` arm, owner 2026-10-13) ──
  // A card saved (nothing charged), checked, then the org is made post-paid and launches.
  function startPostpaid() {
    if (busy || !allTicked(postpaidTicked) || !checkReady()) return;
    if (postpaidArmed.current) {
      void launch();
      return;
    }
    if (postpaidCardSaved.current) {
      void armPostpaid();
      return;
    }
    const limit = monthlyLimitToSave(monthlyLimit, { kind: "postpaid" });
    if ("problem" in limit) {
      setError(limit.problem);
      return;
    }
    posthog.capture("get_started_postpaid_opened", { lp_variant: arm.variant });
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await saveMonthlyLimit(limit.usd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "We could not save your monthly limit. Try again.");
        setBusy(false);
        return;
      }
      await openCardSave(() => void afterPostpaidCardSaved());
    })();
  }

  async function afterPostpaidCardSaved() {
    setBusy(true);
    setError(null);
    if (!(await cardIsFine(null))) return;
    postpaidCardSaved.current = true;
    await armPostpaid();
  }

  // billing refuses post-paid on a card it cannot charge later (409 `postpaid_card_not_allowed`):
  // the same choice as the card check, another card or prepaid.
  async function armPostpaid() {
    setBusy(true);
    setError(null);
    try {
      await setPaymentMode("postpaid");
    } catch (e) {
      const refused = e instanceof ApiError && e.status === 409 ? postpaidRefusalFacts(e.body, knownCard.current) : null;
      if (refused) {
        posthog.capture("get_started_card_risk_shown", { arm: "postpaid", reason: refused.refusedReason, source: "payment_mode", lp_variant: arm.variant });
        setCardRisk(refused);
      } else {
        console.error("[get-started] post-paid did not start:", e);
        setError("Your card is saved, but post-paid could not start. Press the button again.");
      }
      setBusy(false);
      return;
    }
    postpaidArmed.current = true;
    posthog.capture("get_started_card_saved", { plan: "postpaid", lp_variant: arm.variant });
    void launch();
  }

  // ── The saved card's facts (owner 2026-10-13) ──
  // A card in-page that charges nothing (Revolut widget by default, Stripe's embedded form
  // when the org's card lives there); `onSaved` runs once the form reports it.
  async function openCardSave(onSaved: () => void) {
    setBusy(true);
    setError(null);
    try {
      await declareRevolut();
      const setup = await createEmbeddedCardSetup();
      if (setup.mode === "embedded_checkout") {
        cardSaved.current = onSaved;
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
      console.error("[get-started] card setup answered a hosted page to an in-page request", setup);
      throw new Error("[get-started] card setup: no in-page card form");
    } catch (e) {
      console.error("[get-started] card setup failed to open:", e);
      setError("We could not open the card form. Try again.");
      setBusy(false);
    }
  }

  // billing's verdict on the card just saved. The card reaches billing through the
  // provider's webhook a moment after the form reports it, so a missing (or, when one is
  // replacing `previousId`, unchanged) card is read again.
  async function readCardFacts(previousId: string | null): Promise<CardFacts> {
    for (let i = 0; i < 12; i++) {
      const facts = await getSavedCardFacts();
      if (facts.saved && facts.methodId !== previousId) return facts;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("[get-started] the saved card did not reach billing in time");
  }

  // True = go on. False = the warning is up. A failed read is logged and lets the walk go
  // on: the check only warns, and billing's own gates (post-paid refusal, trial refusal)
  // still stop a card they cannot charge.
  async function cardIsFine(previousId: string | null): Promise<boolean> {
    let facts: CardFacts;
    try {
      facts = await readCardFacts(previousId);
    } catch (e) {
      console.error("[get-started] card check failed, going on:", e);
      posthog.capture("get_started_card_check_failed", { arm: soldRef.current, lp_variant: arm.variant });
      return true;
    }
    knownCard.current = facts;
    if (!cardRiskCopy(soldRef.current, facts)) return true;
    posthog.capture("get_started_card_risk_shown", { arm: soldRef.current, reason: facts.refusedReason, country: facts.country, lp_variant: arm.variant });
    setCardRisk(facts);
    setBusy(false);
    return false;
  }

  // "Use another card": a new card saved, checked again, then the arm goes on.
  function pickAnotherCard() {
    const previousId = cardRisk?.methodId ?? null;
    posthog.capture("get_started_card_risk_another_card", { arm: soldRef.current, lp_variant: arm.variant });
    setCardRisk(null);
    void openCardSave(() =>
      void (async () => {
        if (!(await cardIsFine(previousId))) return;
        goOnAfterCard();
      })(),
    );
  }

  // "Continue anyway" (plan, prepaid) or "Switch to prepaid" (post-paid).
  function cardRiskSecondary(action: CardRiskCopy["secondaryAction"]) {
    posthog.capture("get_started_card_risk_secondary", { arm: soldRef.current, action, lp_variant: arm.variant });
    setCardRisk(null);
    if (action === "prepaid") {
      // The prepaid credit step takes over: the same card pays it, or another one.
      setSold("prepaid");
      return;
    }
    goOnAfterCard();
  }

  function goOnAfterCard() {
    if (soldRef.current === "postpaid") {
      postpaidCardSaved.current = true;
      void armPostpaid();
    } else if (soldRef.current === "subscription") void afterTrialCardSaved(true);
    else void launch();
  }

  // ── Launch ──
  async function launch() {
    if (!orgId) return;
    setStage("launching");
    setBusy(true);
    setError(null);
    try {
      const campaignId = await launchFromPreview(
        { brandId, website, offer, targetAudience, plan, answered },
        progress.current,
      );
      await defaultSalesRepToAccountEmail(brandId, user?.primaryEmailAddress?.emailAddress);
      const token = await session?.getToken({ skipCache: true });
      if (!token) throw new Error("Your session expired. Sign in again to finish.");
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("We could not finish setting up your account. Try again.");
      await session?.getToken({ skipCache: true });
      posthog.capture("get_started_launched", { campaigns: plan.reactive ? 2 : 1, plan: soldRef.current, lp_variant: arm.variant });
      try {
        localStorage.removeItem(GET_STARTED_SNAPSHOT_KEY);
      } catch {
        // Nothing to clean up in a tab that never wrote one.
      }
      pingOwner({ event: "launched", domain: website ? pingHostOf(pingWebsiteUrl(website)) : null });
      window.location.assign(v2CampaignHref(orgId, brandId, campaignId));
    } catch (e) {
      console.error("[get-started] launch failed:", e);
      setError(e instanceof Error ? e.message : "The launch stopped. Try again.");
      setStage("card");
      setBusy(false);
    }
  }

  // What the match buys is the CHOSEN campaign's own served figures, never the fleet median.
  const outcomes = outlook?.outcomes ?? null;
  const expectedRoi = outlook?.roi ?? null;

  const urgency =
    stage !== "launching" ? (
      <div className="mb-4 grid gap-2">
        <TrialTimer label={copy.timerLabel} extendedLabel={copy.timerExtendedLabel} />
        <TrialSpots trial={isPlan} />
      </div>
    ) : null;

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
        {/* The match (or the plan's trial credit), and what it buys. */}
        <section className="gs-panel k-popover p-5 md:col-start-1">
          {note && <p className="k-fg2 mb-3 rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-[13px] leading-5">{note}</p>}
          <p className="k-fg text-[22px] font-semibold leading-7 tracking-tight">
            <CountUp value={copy.creditUsd} format={(n) => `$${Math.round(n)}`} ms={800} /> {copy.creditLine}
          </p>
          <ul className="k-fg2 mt-2.5 grid gap-1 text-[13px] leading-5">
            {[
              `We find buyers in ${audience.name}, reach out and follow up.`,
              "We send from our own domains, never yours.",
              "Positive replies land in your inbox.",
            ].map((line, i) => (
              <li key={line} className="gs-in flex gap-2" style={{ animationDelay: `${160 + i * 80}ms` }}>
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          {outlook && (outcomes != null || expectedRoi != null) && (
            <>
              <p className="k-fg mt-4 text-[13px] font-medium">{`Here is what your $${copy.creditUsd} gets you`}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {outcomes != null && (
                  <BuysTile label={outlook.outcome} note="Expected">
                    <CountUp value={outcomes} format={(n) => String(Math.round(n))} ms={900} />
                  </BuysTile>
                )}
                {expectedRoi != null && (
                  <BuysTile label="ROI" note={outlook.basis}>
                    <span className={roiIsGood(expectedRoi) ? "text-[var(--run)]" : undefined}>
                      <CountUp value={expectedRoi} format={(n) => formatRoi(n)} ms={900} />
                    </span>
                  </BuysTile>
                )}
              </div>
              <p className="k-fg3 mt-2 text-[12px] leading-5">From the campaign you chose. An estimate, not a promise.</p>
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
          <Steps stage={stage} cardLabel={sold === "prepaid" ? "Credit" : "Card"} />
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
                    {/* No link to /sign-in: it lands on the dashboard and leaves this walk behind. */}
                    <p className="k-fg3 text-[12px]">Already have an account? Use it above. This brand gets its own organization.</p>
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
                          setCodeFor("signup");
                          setSecondFactor(false);
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

            {stage === "phone" && (
              <form className="mt-4 grid gap-3" onSubmit={(e) => void submitPhone(e)}>
                <div>
                  <p className="k-fg text-[13px] font-medium">Your phone number</p>
                  <p className="k-fg2 text-[13px] leading-5">So we can reach you about your campaign.</p>
                </div>
                <PhoneField
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    setPhoneProblemShown(false);
                    setError(null);
                  }}
                  onBlur={() => setPhoneProblemShown(phone.national.trim() !== "")}
                  problem={phoneProblemShown ? requiredPhoneProblem(phone) : null}
                  disabled={busy}
                />
                <button type="submit" className="k-btn-accent k-cta gs-glow w-full justify-center" disabled={busy}>
                  {busy ? "Saving..." : "Continue"}
                </button>
              </form>
            )}

            {stage === "card" && !cardSecret && cardRisk && (
              <CardRiskNotice
                copy={cardRiskCopy(sold, cardRisk)}
                busy={busy}
                onAnotherCard={pickAnotherCard}
                onSecondary={cardRiskSecondary}
              />
            )}

            {stage === "card" && !cardSecret && !cardRisk && (
              <div className="mt-4 grid gap-3">
                {!consentGiven.current && <Consent brandName={brandName} checked={consent} onChange={setConsent} />}
                {isPlan ? (
                  <>
                    <div>
                      <p className="k-fg text-[13px] font-medium">{copy.cardTitle}</p>
                      <p className="k-fg2 text-[13px] leading-5">{copy.cardNote}</p>
                    </div>
                    <SpendConsent lines={planConsent} ticked={planTicked} onChange={setPlanTicked} disabled={busy} />
                    <button type="button" className="k-cta k-btn-accent gs-glow w-full justify-center" onClick={() => startTrial()} disabled={busy || !allTicked(planTicked)}>
                      {busy ? "Opening the card form..." : copy.cardCta}
                    </button>
                  </>
                ) : sold === "postpaid" ? (
                  <>
                    <div>
                      <p className="k-fg text-[13px] font-medium">{copy.cardTitle}</p>
                      <p className="k-fg2 text-[13px] leading-5">{copy.cardNote}</p>
                    </div>
                    <SpendConsent lines={postpaidConsent} ticked={postpaidTicked} onChange={setPostpaidTicked} disabled={busy} />
                    <button type="button" className="k-cta k-btn-accent gs-glow w-full justify-center" onClick={() => startPostpaid()} disabled={busy || !allTicked(postpaidTicked)}>
                      {busy ? "Saving your card..." : copy.cardCta}
                    </button>
                  </>
                ) : paid ? (
                  <button type="button" className="k-cta k-btn-accent gs-glow w-full justify-center" onClick={() => void afterPaid(paid)} disabled={busy}>
                    {busy ? "Checking your payment..." : "Check my payment and launch"}
                  </button>
                ) : (
                  <PrepaidTopup busy={busy} matchNote={matchNote(account)} monthlyLimit={monthlyLimit} cta={(usd) => topupCta(usd, matchNote(account))} onPay={(c) => void pay(c)} />
                )}
              </div>
            )}

            {stage === "card" && cardSecret && (
              <div className="mt-4 grid gap-2">
                <p className="k-fg text-[13px] font-medium">{copy.cardTitle}</p>
                <EmbeddedCheckoutProvider
                  stripe={getStripe()}
                  options={{
                    clientSecret: cardSecret,
                    onComplete: () => {
                      const saved = cardSaved.current;
                      if (saved) {
                        cardSaved.current = null;
                        setCardSecret(null);
                        setBusy(true);
                        saved();
                        return;
                      }
                      if (soldRef.current === "subscription") {
                        void afterTrialCardSaved();
                        return;
                      }
                      const held = pendingReload.current;
                      if (held) void afterPaid(held);
                    },
                  }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}

            {stage === "launching" && (
              <div className="mt-4 grid gap-2">
                <p className="k-fg2 text-[13px]">Creating your audiences and starting your campaigns...</p>
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

function Steps({ stage, cardLabel }: { stage: Stage; cardLabel: string }) {
  const at = stage === "account" || stage === "code" || stage === "claim" || stage === "phone" ? 0 : stage === "card" ? 1 : 2;
  const items = ["Account", cardLabel, "Start"];
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
