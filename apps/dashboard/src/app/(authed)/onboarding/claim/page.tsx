"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

/**
 * The hinge: the account exists, so the org they built IS theirs.
 *
 * Signup lands here rather than on the dashboard, because the ORDER matters. An
 * anonymous session's work sits on an org with no identity provider; until that
 * org is re-pointed at the Clerk org the visitor just made, every authed read
 * resolves to the NEW org instead and their ten minutes look lost. So the claim
 * runs first, on its own screen, and nothing else is reachable until it has.
 *
 * ONCE. A ref latch rather than a state flag: an effect that re-fires under
 * React's development double-invoke would send a second claim, and while
 * client-service treats a replay as success, a second request on the one call
 * that matters is not something to rely on being harmless.
 *
 * Failing here does NOT lose anything. The anonymous token is kept on a refusal
 * precisely so this can be retried, and the retry is the whole recovery.
 */
export default function ClaimPage() {
  const router = useRouter();
  const { isLoaded, userId, orgId } = useAuth();
  const [failed, setFailed] = useState(false);
  const claimed = useRef(false);

  useEffect(() => {
    // Clerk has to have BOTH before the claim can name the org to point at.
    if (!isLoaded || !userId || !orgId || claimed.current) return;
    claimed.current = true;

    void (async () => {
      try {
        const res = await fetch("/api/anon/claim", { method: "POST" });
        if (!res.ok) {
          console.error(`[claim] failed: ${res.status}`);
          setFailed(true);
          return;
        }
<<<<<<< HEAD
        // Back into the wizard, at the money.
        //
        // The brand id rides along so a return in a tab with no snapshot still
        // resolves the brand from brand-service rather than starting over; with
        // a snapshot the `claimed` flag lands them on the budget step directly.
        // An ordinary signup has nothing to claim and takes the same path.
        const body = (await res.json().catch(() => null)) as { brandId?: unknown } | null;
        const brandId = typeof body?.brandId === "string" ? body.brandId : "";
        router.replace(
          brandId
            ? `/onboarding?claimed=1&brandId=${encodeURIComponent(brandId)}`
            : "/onboarding?claimed=1",
        );
=======
        // Whether there was anything to claim or not, the next thing is paying
        // for what they picked — an ordinary signup has nothing to claim and
        // takes exactly the same path.
        router.replace("/onboarding/pay");
>>>>>>> origin/main
      } catch (err) {
        console.error("[claim] errored:", err);
        setFailed(true);
      }
    })();
  }, [isLoaded, userId, orgId, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      {failed ? (
        <>
          <h1 className="font-display text-xl font-bold text-gray-900">
            We couldn&apos;t finish setting up your account.
          </h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
            Nothing is lost. Try again, and everything you set up will still be here.
          </p>
          <button
            onClick={() => {
              claimed.current = false;
              setFailed(false);
            }}
            className="mt-5 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Try again
          </button>
        </>
      ) : (
        <>
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="mt-4 text-sm text-gray-500">Setting up your account…</p>
        </>
      )}
    </div>
  );
}
