"use client";

import { useEffect, useRef } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { ApiError, claimInvite, getBillingAccount, type BillingAccount } from "@/lib/api";
import {
  inviteCodeFromCookie,
  inviteCookieClear,
  isTerminalClaimRejection,
} from "@/lib/invite-link";

/**
 * Spends the referral code `InviteCapture` stored, once there is an org to
 * attribute it to.
 *
 * Capture and claim are separate on purpose. The code arrives while the visitor
 * is signing up, which is precisely when no org exists yet, so the claim cannot
 * run in the same breath. It runs here instead: mounted on the authed dashboard
 * shell, where an org is guaranteed.
 *
 * ## Why it retries across page loads instead of firing once
 *
 * A claim that never lands leaves two orgs owed $500 each and nothing on screen
 * says so, so this keeps the code until the claim is actually recorded. One
 * attempt per mount (never a loop), and the cookie is cleared only on success or
 * on a rejection that will answer the same way forever. Everything else, cold
 * service, offline tab, a gateway leg not yet deployed, leaves the code on disk
 * for the next visit.
 *
 * The org id is the INTERNAL UUID, which the invite routes require and the Clerk
 * org id in the URL is not. `BillingAccount.org_id` carries it and is already
 * fetched on every dashboard page, so this adds no request.
 */
export function InviteClaimer() {
  const attempted = useRef<string | null>(null);

  const { data: account } = useAuthQuery<BillingAccount>(["billingAccount"], () =>
    getBillingAccount(),
  );

  useEffect(() => {
    const orgId = account?.org_id;
    if (!orgId) return;

    const code = inviteCodeFromCookie(document.cookie);
    if (!code) return;

    // One attempt per (org, code) per mount. A failure is retried on the next
    // page load, not in a loop here.
    const attemptKey = `${orgId}:${code}`;
    if (attempted.current === attemptKey) return;
    attempted.current = attemptKey;

    void (async () => {
      try {
        await claimInvite(orgId, code);
        document.cookie = inviteCookieClear();
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        if (isTerminalClaimRejection(status)) {
          console.error("[dashboard] invite claim rejected for good, dropping the code", {
            status,
            err,
          });
          document.cookie = inviteCookieClear();
          return;
        }
        // Keep the code. This is the branch that protects the $500.
        console.error("[dashboard] invite claim failed, keeping the code to retry", {
          status,
          err,
        });
      }
    })();
  }, [account?.org_id]);

  return null;
}
