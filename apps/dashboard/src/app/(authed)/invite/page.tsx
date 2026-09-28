"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useOrganizationList } from "@clerk/nextjs";
import { useSignIn, useSignUp } from "@clerk/nextjs/legacy";
import posthog from "posthog-js";
import { authFailureProps, clerkErrorMessage } from "@/lib/clerk-error";
import { inviteLandingHref, parseInviteBrand, parseInviteStatus } from "@/lib/org-invite";
import { CHROMA_VAR, DELTA_VAR, HUE_VAR, TINT_ATTR } from "@/lib/brand-tint";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Where the link in an organization invitation lands.
 *
 * Clerk appends `__clerk_ticket` and `__clerk_status` to the URL the inviter's
 * request named (`/invite?org=<id>`). Our sign-in and sign-up pages are custom and
 * never read a ticket, so without this page an invitee would sign up normally and
 * end up in an organization of their own instead of the one they were invited to.
 *
 * Three cases, all ending with THAT org active and the person on its dashboard:
 * - already signed in: accept the pending invitation from their own account;
 * - `sign_in`: the address has an account, so the ticket signs them straight in;
 * - `sign_up`: no account yet. Either Google, or a password; both go through the
 *   ticket, which creates the account (the email is already verified by the link)
 *   and joins them. Google CONTINUES the ticket sign-up (`continueSignUp`) rather
 *   than starting a fresh one, which would lose the invitation.
 */
const MIN_PASSWORD_LENGTH = 8;

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteFlow />
    </Suspense>
  );
}

function InviteFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const ticket = params.get("__clerk_ticket");
  const status = parseInviteStatus(params.get("__clerk_status"));
  const orgId = params.get("org");
  const landing = inviteLandingHref(orgId);
  const brand = parseInviteBrand(params);
  const tintHue = brand?.tint?.hue ?? null;
  const tintChroma = brand?.tint?.chromaScale ?? null;
  const tintDelta = brand?.tint?.hueDelta ?? null;

  // The page wears the inviting brand's accent, through the same <html> variables
  // `BrandTint` writes on every brand page, so the button and the tints rotate to it.
  useEffect(() => {
    if (tintHue === null || tintChroma === null || tintDelta === null) return;
    const root = document.documentElement;
    root.style.setProperty(HUE_VAR, String(tintHue));
    root.style.setProperty(CHROMA_VAR, String(tintChroma));
    root.style.setProperty(DELTA_VAR, String(tintDelta));
    root.setAttribute(TINT_ATTR, "");
    return () => {
      root.removeAttribute(TINT_ATTR);
      root.style.removeProperty(HUE_VAR);
      root.style.removeProperty(CHROMA_VAR);
      root.style.removeProperty(DELTA_VAR);
    };
  }, [tintHue, tintChroma, tintDelta]);

  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { userInvitations, setActive: setOrgActive, isLoaded: listLoaded } = useOrganizationList({
    userInvitations: { infinite: true },
  });

  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googling, setGoogling] = useState(false);
  const started = useRef(false);

  // Already signed in: accept from the account itself. A ticket cannot be used on
  // top of a live session, and the person may simply have clicked the link while
  // logged in.
  useEffect(() => {
    if (!authLoaded || !isSignedIn || !listLoaded || started.current) return;
    if (userInvitations?.isLoading) return;
    started.current = true;
    void (async () => {
      try {
        const pending = (userInvitations?.data ?? []).find(
          (inv) => inv.publicOrganizationData.id === orgId && inv.status === "pending",
        );
        if (pending) await pending.accept();
        if (orgId) await setOrgActive?.({ organization: orgId });
        posthog.capture("org_invite_accepted", { path: "signed_in" });
        router.replace(landing);
      } catch (err) {
        started.current = false;
        console.error("[invite] accept while signed in failed", err);
        posthog.capture("org_invite_failed", authFailureProps(err, { stage: "signed_in" }));
        setError(
          "This invitation was sent to another email address than the account you are signed in with. Sign out, then open the link from the email again.",
        );
      }
    })();
  }, [authLoaded, isSignedIn, listLoaded, userInvitations, orgId, setOrgActive, router, landing]);

  // An existing account: the ticket alone signs them in and joins them.
  useEffect(() => {
    if (!authLoaded || isSignedIn || status !== "sign_in" || !ticket || !signInLoaded || !signIn || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const res = await signIn.create({ strategy: "ticket", ticket });
        if (res.status !== "complete") {
          posthog.capture("org_invite_incomplete", { stage: "sign_in", status: res.status ?? "unknown" });
          setError("Sign in to accept this invitation.");
          return;
        }
        await setSignInActive({ session: res.createdSessionId, organization: orgId ?? undefined });
        posthog.capture("org_invite_accepted", { path: "sign_in" });
        router.replace(landing);
      } catch (err) {
        console.error("[invite] ticket sign-in failed", err);
        posthog.capture("org_invite_failed", authFailureProps(err, { stage: "sign_in" }));
        setError(clerkErrorMessage(err));
      }
    })();
  }, [authLoaded, isSignedIn, status, ticket, signInLoaded, signIn, setSignInActive, orgId, router, landing]);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !signUpLoaded || !signUp || submitting || password.length < MIN_PASSWORD_LENGTH) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await signUp.create({ strategy: "ticket", ticket, password });
      if (res.status !== "complete") {
        posthog.capture("org_invite_incomplete", { stage: "sign_up", status: res.status ?? "unknown" });
        setError(`We could not finish creating the account (${res.status}). Try again.`);
        return;
      }
      await setSignUpActive({ session: res.createdSessionId, organization: orgId ?? undefined });
      posthog.capture("org_invite_accepted", { path: "sign_up" });
      router.replace(landing);
    } catch (err) {
      console.error("[invite] ticket sign-up failed", err);
      posthog.capture("org_invite_failed", authFailureProps(err, { stage: "sign_up" }));
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const joinWithGoogle = async () => {
    if (!ticket || !signUpLoaded || !signUp || googling || submitting) return;
    setGoogling(true);
    setError("");
    try {
      // Open the sign-up ON the ticket first, then let Google complete that same
      // sign-up: Clerk then creates the account and the membership together.
      await signUp.create({ strategy: "ticket", ticket });
      posthog.capture("org_invite_google_started");
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: landing,
        continueSignUp: true,
      });
    } catch (err) {
      console.error("[invite] Google sign-up failed", err);
      posthog.capture("org_invite_failed", authFailureProps(err, { stage: "google" }));
      setError(clerkErrorMessage(err));
      setGoogling(false);
    }
  };

  let body: React.ReactNode;
  if (error) {
    body = (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    );
  } else if (isSignedIn || status === "sign_in") {
    body = <p className="text-sm text-gray-500">Joining the organization...</p>;
  } else if (status === "complete") {
    body = (
      <p className="text-sm text-gray-600">
        You already accepted this invitation.{" "}
        <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>{" "}
        to open the dashboard.
      </p>
    );
  } else if (status === "sign_up" && ticket) {
    body = (
      <form onSubmit={createAccount} className="flex flex-col gap-3">
        <button
          type="button"
          onClick={joinWithGoogle}
          disabled={googling || submitting}
          aria-busy={googling}
          className={`flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[15px] font-medium text-gray-900 ${
            googling ? "cursor-wait" : "hover:bg-gray-50"
          }`}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googling ? "Opening Google..." : "Continue with Google"}
        </button>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          or
          <span className="h-px flex-1 bg-gray-200" />
        </div>
        <p className="text-sm text-gray-600">Choose a password to create your account and join the team.</p>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Create a password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[15px] text-gray-900 outline-none focus:border-brand-500"
        />
        <p className="-mt-1.5 text-xs text-gray-500">{`At least ${MIN_PASSWORD_LENGTH} characters`}</p>
        <div id="clerk-captcha" />
        <button
          type="submit"
          disabled={submitting || password.length < MIN_PASSWORD_LENGTH}
          aria-busy={submitting}
          className={`w-full rounded-xl px-4 py-3 text-[15px] font-semibold text-white ${brand?.mono ? "bg-gray-900" : "bg-brand-600"} ${
            submitting ? "cursor-wait" : password.length < MIN_PASSWORD_LENGTH ? "cursor-not-allowed opacity-50" : "hover:brightness-105"
          }`}
        >
          {submitting ? "Creating account..." : "Join the team"}
        </button>
      </form>
    );
  } else {
    body = (
      <p className="text-sm text-gray-600">
        This invitation link is incomplete. Open it again from the email, or ask the person who invited you to send a new one.
      </p>
    );
  }

  return (
    <div className={`flex min-h-screen items-center justify-center p-8 ${brand && !brand.mono ? "bg-brand-50" : "bg-gray-50"}`}>
      <div className="w-full max-w-md">
        {/* Who is inviting, before anything else: our mark, a cross, then theirs. */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="https://distribute.you" className="inline-flex items-center gap-2">
            <Image src="/logo-distribute.svg" alt="distribute.you" width={28} height={28} />
            <span className="text-lg font-semibold text-gray-900">distribute.you</span>
          </Link>
          {brand && (
            <>
              <span aria-hidden="true" className="text-lg text-gray-400">
                ×
              </span>
              <span className="inline-flex min-w-0 items-center gap-2">
                {/* A black-and-white brand's logo is usually white on its own dark
                    background, so it sits on that background here too. */}
                <span
                  className={`inline-flex shrink-0 rounded-md ${brand.mono ? "p-1" : ""}`}
                  style={brand.mono ? { background: brand.mono } : undefined}
                >
                  <BrandLogo domain={brand.domain} logoUrl={brand.logoUrl} size={brand.mono ? 22 : 28} className="rounded" fallbackClassName="text-gray-400" />
                </span>
                <span className="truncate text-lg font-semibold text-gray-900">{brand.name}</span>
              </span>
            </>
          )}
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
          {brand ? `Join the ${brand.name} team` : "You are invited to join a team"}
        </h1>
        <div className={`rounded-2xl border bg-white p-6 ${brand && !brand.mono ? "border-brand-200" : "border-gray-200"}`}>{body}</div>
      </div>
    </div>
  );
}
