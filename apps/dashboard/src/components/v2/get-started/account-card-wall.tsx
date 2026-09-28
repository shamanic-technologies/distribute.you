"use client";

/**
 * The one wall of `/get-started`: the account and the card, on ONE screen, the way
 * Explee asks for them together once the founder has seen the output.
 *
 * The screen walks four states in place, never navigating away (the Google button is
 * the one exception, and it comes straight back here with `?resume=1`):
 *   1. account  — email + password (then the emailed code), or Google;
 *   2. claim    — the anonymous org they built is re-pointed at the account they just
 *                 made (`/api/anon/claim`, the same hinge `/onboarding/claim` runs);
 *   3. card     — a card saved in the page, charging nothing: the $30 free credit is
 *                 spent first, then the card is charged at most the daily budget;
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
import { GET_STARTED_SNAPSHOT_KEY, parseDailyBudget, type GetStartedSegment } from "@/lib/v2/get-started";
import { EMPTY_PROGRESS, launchFromPreview, type LaunchProgress } from "./launch";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Stage = "account" | "code" | "claim" | "card" | "launching";

export function AccountCardWall({
  brandId,
  website,
  brandName,
  offerSource,
  segments,
  floorUsd,
  recommendedUsd,
  onBudget,
  onClose,
}: {
  brandId: string;
  website: string;
  brandName: string;
  offerSource: string;
  segments: GetStartedSegment[];
  floorUsd: number;
  recommendedUsd: number | null;
  onBudget: (usd: number) => void;
  onClose: () => void;
}) {
  const { isLoaded: authLoaded, isSignedIn, orgId } = useAuth();
  const { session } = useSession();
  const { user } = useUser();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();

  const [stage, setStage] = useState<Stage>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  // No price held yet: the channel's own floor, the smallest budget it runs on.
  const [budget, setBudget] = useState(String(recommendedUsd ?? Math.ceil(floorUsd)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardSecret, setCardSecret] = useState<string | null>(null);
  const [account, setAccount] = useState<BillingAccount | null>(null);

  const claimed = useRef(false);
  const progress = useRef<LaunchProgress>({ ...EMPTY_PROGRESS });

  // A recommendation that lands after the wall opened fills an untouched field.
  const budgetTouched = useRef(false);
  useEffect(() => {
    if (!budgetTouched.current) setBudget(String(recommendedUsd ?? Math.ceil(floorUsd)));
  }, [recommendedUsd, floorUsd]);

  // Esc closes while nothing is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && stage !== "launching") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, stage, onClose]);

  // Once signed in, claim the anonymous org. Clerk needs both the user and the org it
  // auto-creates at signup before the claim can name the org to point at.
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !orgId || claimed.current) return;
    claimed.current = true;
    setStage("claim");
    void (async () => {
      setBusy(true);
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
      } catch (e) {
        claimed.current = false;
        setError(e instanceof Error ? e.message : "We could not finish setting up your account.");
      } finally {
        setBusy(false);
      }
    })();
  }, [authLoaded, isSignedIn, orgId, session]);

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
    onBudget(parsedBudget.usd);
    return true;
  }

  // ── Account ──
  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded || !signUp || busy) return;
    if (!checkReady()) return;
    setBusy(true);
    setError(null);
    try {
      posthog.capture("get_started_signup_email_started");
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("code");
    } catch (err) {
      posthog.capture("get_started_signup_failed", authFailureProps(err, { stage: "create" }));
      console.error("[get-started] sign up failed:", err);
      setError(clerkErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded || !signUp || busy) return;
    setBusy(true);
    setError(null);
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
        { brandId, website, offerSource, audienceIds: segments.map((s) => s.audienceId), budgetUsd },
        progress.current,
      );
      const token = await session?.getToken({ skipCache: true });
      if (!token) throw new Error("Your session expired. Sign in again to finish.");
      const res = await fetch("/api/onboarding/complete", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("We could not finish setting up your account. Try again.");
      await session?.getToken({ skipCache: true });
      posthog.capture("get_started_launched", { budget_usd: budgetUsd, segments: segments.length });
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

  const freeCents = account?.free_credit_spendable_cents != null && account.free_credit_spendable_cents.trim() !== ""
    ? Number(account.free_credit_spendable_cents)
    : null;

  return createPortal(
    <div className="v2-root fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[#1010121f] px-3 py-[6vh]">
      <div role="dialog" aria-modal="true" aria-label="Start outreach" className="k-popover w-full max-w-[880px] overflow-hidden">
        <div className="flex h-11 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span className="k-label">Start outreach</span>
          <button
            type="button"
            aria-label="Close"
            className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0"
            onClick={onClose}
            disabled={busy || stage === "launching"}
          >
            ×
          </button>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* What they get */}
          <div className="border-b border-[var(--line-subtle)] p-5 md:border-b-0 md:border-r">
            <p className="k-fg text-[20px] font-medium leading-7">$30 of free credit</p>
            <ul className="k-fg2 mt-3 grid gap-1.5 text-[13px] leading-5">
              <li>We find the people in your segments and write to them from our own warmed domains.</li>
              <li>Each email is written for the person it goes to.</li>
              <li>Interested replies are forwarded to your inbox.</li>
            </ul>

            <dl className="k-inset mt-5 grid gap-2 rounded-lg p-3 text-[13px]">
              <div className="flex gap-2">
                <dt className="k-label w-24 shrink-0 pt-0.5">Company</dt>
                <dd className="k-fg min-w-0 truncate">{brandName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="k-label w-24 shrink-0 pt-0.5">Segments</dt>
                <dd className="k-fg2 tabular-nums">{segments.length}</dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="k-label w-24 shrink-0">Daily budget</dt>
                <dd className="flex items-center gap-1.5">
                  <span className="k-fg2">$</span>
                  <input
                    className="k-input h-7 w-20 px-2 text-right tabular-nums"
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
                  <span className="k-fg3 text-[12px]">a day</span>
                </dd>
              </div>
            </dl>
            <p className="k-fg3 mt-2 text-[12px] leading-5">
              {`We spend your $30 of free credit first. After that your card is charged for what the campaign spends, never more than your daily budget. Pause or stop anytime.`}
            </p>
          </div>

          {/* Account + card */}
          <div className="p-5">
            <Steps stage={stage} />

            {(stage === "account" || stage === "code") && !isSignedIn && (
              <>
                {stage === "account" ? (
                  <form className="mt-4 grid gap-3" onSubmit={(e) => void submitAccount(e)}>
                    <button type="button" className="k-btn h-9 justify-center" onClick={() => void google()} disabled={busy}>
                      Continue with Google
                    </button>
                    <p className="k-fg3 text-center text-[12px]">or</p>
                    <label className="grid gap-1">
                      <span className="k-label">Work email</span>
                      <input className="k-input h-9 px-2.5" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <label className="grid gap-1">
                      <span className="k-label">Password</span>
                      <input className="k-input h-9 px-2.5" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <span className="k-fg3 text-[12px]">{`At least ${MIN_PASSWORD_LENGTH} characters.`}</span>
                    </label>
                    <Consent brandName={brandName} checked={consent} onChange={setConsent} />
                    <div id="clerk-captcha" />
                    <button
                      type="submit"
                      className="k-btn-accent h-9 justify-center"
                      disabled={busy || !EMAIL_SHAPE.test(email.trim()) || password.length < MIN_PASSWORD_LENGTH}
                    >
                      {busy ? "Creating your account..." : "Create account"}
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
                    <p className="k-fg2 text-[13px]">{`We sent a code to ${email}.`}</p>
                    <label className="grid gap-1">
                      <span className="k-label">Code</span>
                      <input
                        className="k-input h-9 px-2.5 tracking-[0.3em] tabular-nums"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={VERIFICATION_CODE_LENGTH}
                        value={code}
                        onChange={(e) => setCode(sanitizeVerificationCode(e.target.value))}
                        autoFocus
                      />
                    </label>
                    <button type="submit" className="k-btn-accent h-9 justify-center" disabled={busy || code.length !== VERIFICATION_CODE_LENGTH}>
                      {busy ? "Checking..." : "Verify"}
                    </button>
                  </form>
                )}
              </>
            )}

            {stage === "claim" && <p className="k-fg2 mt-4 text-[13px]">{busy ? "Setting up your account..." : "Your account is ready."}</p>}

            {stage === "card" && !cardSecret && (
              <div className="mt-4 grid gap-3">
                <p className="k-fg2 text-[13px] leading-5">
                  {account?.has_payment_method
                    ? "Your card is on file."
                    : "Add a card to confirm you are real. Nothing is charged today."}
                </p>
                {freeCents != null && freeCents > 0 && (
                  <p className="k-fg3 text-[12px] tabular-nums">{`Free credit on your account: $${Math.round(freeCents / 100)}`}</p>
                )}
                <Consent brandName={brandName} checked={consent} onChange={setConsent} />
                <button type="button" className="k-btn-accent h-9 justify-center" onClick={() => void addCard()} disabled={busy}>
                  {busy ? "Opening..." : account?.has_payment_method ? "Start outreach" : "Add card and start"}
                </button>
              </div>
            )}

            {stage === "card" && cardSecret && (
              <div className="mt-4">
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret: cardSecret, onComplete: () => void afterCardSaved() }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}

            {stage === "launching" && (
              <p className="k-fg2 mt-4 text-[13px]">Creating your audiences, funding the campaign and starting it...</p>
            )}

            {error && (
              <p className="mt-3 text-[13px] text-[var(--data-rose)]" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
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
    <ol className="flex items-center gap-2" aria-label="Setup">
      {items.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-4 bg-[var(--line)]" />}
          <span className={`text-[12px] ${i === at ? "k-fg font-medium" : i < at ? "k-fg2" : "k-fg3"}`}>{`${i + 1}. ${label}`}</span>
        </li>
      ))}
    </ol>
  );
}
