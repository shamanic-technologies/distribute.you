"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import { claimJoin } from "@/components/team/join-claimer";
import { useSignUp } from "@clerk/nextjs/legacy";
import posthog from "posthog-js";
import { clerkErrorMessage } from "@/lib/clerk-error";
import { joinCookieAssignment, parseInviteBrand, parseJoinToken } from "@/lib/org-invite";
import { CHROMA_VAR, DELTA_VAR, HUE_VAR, TINT_ATTR } from "@/lib/brand-tint";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Where a team's shareable invite link lands (`/join/<orgId>.<code>`).
 *
 * The link carries no email, so there is no ticket: the person signs in or creates
 * an account however they like, and `JoinClaimer` (mounted on every authed page) does
 * the join the moment they are signed in. That is what the cookie is for: it survives
 * whichever auth route they take, email or Google, sign-up or sign-in.
 */
export function JoinPageClient({ token }: { token: string }) {
  const valid = parseJoinToken(token) !== null;
  const search = useSearchParams();
  const brand = parseInviteBrand(search);
  const revoked = search.get("error") === "revoked";
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [googling, setGoogling] = useState(false);
  const [error, setError] = useState("");
  const clerk = useClerk();
  const router = useRouter();
  const claiming = useRef(false);

  useEffect(() => {
    if (valid && !revoked) document.cookie = joinCookieAssignment(token);
  }, [valid, revoked, token]);

  // Already signed in (or just back from Google): join right here. This page is
  // where the person is looking, so it owns the join and says so if it fails.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !valid || revoked || claiming.current) return;
    claiming.current = true;
    claimJoin(token, clerk, router)
      .then((done) => {
        if (!done) {
          claiming.current = false;
          setError("We could not add you to the team. Reload the page to try again.");
        }
      })
      .catch((err) => {
        claiming.current = false;
        console.error("[join] claim failed", err);
        setError("We could not add you to the team. Reload the page to try again.");
      });
  }, [isLoaded, isSignedIn, valid, revoked, token, clerk, router]);

  const tint = brand?.tint ?? null;
  useEffect(() => {
    if (!tint) return;
    const root = document.documentElement;
    root.style.setProperty(HUE_VAR, String(tint.hue));
    root.style.setProperty(CHROMA_VAR, String(tint.chromaScale));
    root.style.setProperty(DELTA_VAR, String(tint.hueDelta));
    root.setAttribute(TINT_ATTR, "");
    return () => {
      root.removeAttribute(TINT_ATTR);
      root.style.removeProperty(HUE_VAR);
      root.style.removeProperty(CHROMA_VAR);
      root.style.removeProperty(DELTA_VAR);
    };
  }, [tint?.hue, tint?.chromaScale, tint?.hueDelta]); // eslint-disable-line react-hooks/exhaustive-deps

  const withGoogle = async () => {
    if (!signUpLoaded || !signUp || googling) return;
    setGoogling(true);
    setError("");
    try {
      posthog.capture("team_join_google_started");
      // Signing up with Google on an existing Google account signs in instead; either
      // way the person comes back here, and the claimer joins them.
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: `/join/${encodeURIComponent(token)}`,
      });
    } catch (err) {
      console.error("[join] Google failed", err);
      setError(clerkErrorMessage(err));
      setGoogling(false);
    }
  };

  let body: React.ReactNode;
  if (!valid || revoked) {
    body = (
      <p className="text-sm text-gray-600">
        This invite link is no longer valid. Ask your team for a new one.
      </p>
    );
  } else if (!isLoaded) {
    body = <div className="h-24 animate-pulse rounded-xl bg-gray-100" />;
  } else if (isSignedIn) {
    body = error ? (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    ) : (
      <p className="text-sm text-gray-500">Joining the team...</p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={withGoogle}
          disabled={googling}
          aria-busy={googling}
          className={`flex w-full items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-3 text-[15px] font-medium text-gray-900 ${googling ? "cursor-wait" : "hover:bg-gray-50"}`}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googling ? "Opening Google..." : "Continue with Google"}
        </button>
        <Link
          href="/sign-up"
          className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-[15px] font-semibold text-white hover:brightness-110 ${brand?.mono ? "bg-gray-900" : "bg-brand-600"}`}
        >
          Create an account with email
        </Link>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/sign-in" className={`font-medium ${brand?.mono ? "text-gray-900 underline" : "text-brand-600 hover:text-brand-700"}`}>
            Sign in
          </Link>
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen items-center justify-center p-8 ${brand && !brand.mono ? "bg-brand-50" : "bg-gray-50"}`}>
      <div className="w-full max-w-md">
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
                {/* The logo sits on the page as is. A tile in the brand's dominant colour
                    was tried and hid Olive's logo, which IS that colour (a black olive on
                    transparent): the dominant colour of a logo is not its background. */}
                <BrandLogo domain={brand.domain} logoUrl={brand.logoUrl} size={28} className="rounded-md" fallbackClassName="text-gray-400" />
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
