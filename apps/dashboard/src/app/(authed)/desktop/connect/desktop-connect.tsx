"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useSignUp } from "@clerk/nextjs/legacy";
import posthog from "posthog-js";
import { createApiKey } from "@/lib/api";
import { clerkErrorMessage } from "@/lib/clerk-error";
import {
  DESKTOP_CONNECT_PATH,
  DESKTOP_KEY_NAME,
  clearDesktopConnect,
  desktopCallbackUrl,
  parkDesktopConnect,
  parseDesktopConnect,
  readParkedDesktopConnect,
  type DesktopConnectRequest,
} from "@/lib/desktop-connect";

/**
 * distribute for Mac's browser sign-in (`lib/desktop-connect.ts` has the protocol).
 * Signed out: the dashboard's own Google or email sign-in. Signed in with an
 * organization: mint a user API key and hand it to the app on 127.0.0.1.
 */
export function DesktopConnectClient() {
  const search = useSearchParams();
  const router = useRouter();
  // A brand-new account is a PENDING session until it has an organization: count it
  // as signed in here so it goes to the organization step, not back to sign-in.
  const { isLoaded, isSignedIn, orgId } = useAuth({ treatPendingAsSignedOut: false });
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const [request, setRequest] = useState<DesktopConnectRequest | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [googling, setGoogling] = useState(false);
  const [sent, setSent] = useState(false);
  const minting = useRef(false);

  // The app's request rides the URL the first time and sessionStorage after a sign-in hop.
  useEffect(() => {
    const fromUrl = parseDesktopConnect(search.get("port"), search.get("state"));
    if (fromUrl) {
      parkDesktopConnect(window.sessionStorage, fromUrl, Date.now());
      setRequest(fromUrl);
      return;
    }
    setRequest(readParkedDesktopConnect(window.sessionStorage, Date.now()));
  }, [search]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !request || minting.current) return;
    if (!orgId) {
      router.replace("/session-tasks/choose-organization");
      return;
    }
    minting.current = true;
    createApiKey(DESKTOP_KEY_NAME)
      .then((created) => {
        clearDesktopConnect(window.sessionStorage);
        posthog.capture("desktop_connected");
        setSent(true);
        window.location.href = desktopCallbackUrl(request, created.key);
      })
      .catch((err) => {
        minting.current = false;
        console.error("[dashboard] desktop connect: could not create the API key", err);
        setError("We could not connect the app. Reload this page to try again.");
      });
  }, [isLoaded, isSignedIn, orgId, request, router]);

  const withGoogle = async () => {
    if (!signUpLoaded || !signUp || googling) return;
    setGoogling(true);
    setError("");
    try {
      posthog.capture("desktop_connect_google_started");
      // An existing Google account signs in instead; either way it comes back here.
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: DESKTOP_CONNECT_PATH,
      });
    } catch (err) {
      console.error("[dashboard] desktop connect: Google failed", err);
      setError(clerkErrorMessage(err));
      setGoogling(false);
    }
  };

  let body: React.ReactNode;
  if (request === null) {
    body = (
      <p className="text-sm text-gray-600">
        This link has expired. Open distribute for Mac and click Continue again.
      </p>
    );
  } else if (!isLoaded || request === undefined) {
    body = <div className="h-24 animate-pulse rounded-xl bg-gray-100" />;
  } else if (error) {
    body = (
      <p role="alert" className="text-sm text-red-600">
        {error}
      </p>
    );
  } else if (sent) {
    body = <p className="text-sm text-gray-600">Connected. You can go back to the app.</p>;
  } else if (isSignedIn) {
    body = <p className="text-sm text-gray-600">Connecting the app…</p>;
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={withGoogle}
          disabled={googling}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {googling ? "Opening Google…" : "Continue with Google"}
        </button>
        <Link
          href="/sign-in"
          className="flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Continue with email
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Image src="/logo-distribute.svg" alt="distribute.you" width={28} height={28} />
          <span className="text-lg font-semibold text-gray-900">distribute.you</span>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Connect distribute for Mac</h1>
          <p className="mt-1 mb-5 text-sm text-gray-600">Sign in once. The app does the rest.</p>
          {body}
        </div>
      </div>
    </div>
  );
}
