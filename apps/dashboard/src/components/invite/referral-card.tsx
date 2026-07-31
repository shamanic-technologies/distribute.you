"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getInviteStatus,
  type BillingAccount,
  type InviteStatus,
} from "@/lib/api";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { REFERRAL_CREDIT_USD, inviteLinkForCode } from "@/lib/invite-link";

/**
 * The referral card, anchored at the bottom of the brand sidebar.
 *
 * The link carries this org's real invite code, so a signup through it is
 * actually attributed. An earlier version of this card copied a bare landing URL
 * with a UTM parameter and no backend at all, which credited nobody while
 * promising credits on screen. If the code cannot be read, the card renders
 * nothing rather than offering a link that leads to no reward.
 *
 * The tooltip states the mechanism truthfully: neither side is given anything at
 * signup. The invitee's credits unlock as their own payments reach the amount,
 * and the inviter's open only once the invitee has actually earned theirs.
 */

const CopyIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

export function ReferralCard() {
  const [copied, setCopied] = useState(false);

  // The invite routes key on the INTERNAL org UUID, not the Clerk org id in the
  // URL. Both queries are already fetched elsewhere on the shell, so they dedupe.
  const { data: account } = useAuthQuery<BillingAccount>(["billingAccount"], () =>
    getBillingAccount(),
  );
  const orgId = account?.org_id ?? null;

  const { data: invite } = useAuthQuery<InviteStatus>(
    ["inviteStatus", orgId ?? "none"],
    () => getInviteStatus(orgId!),
    { enabled: !!orgId },
  );

  const link = inviteLinkForCode(invite?.code);
  if (!link) return null;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-2">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2">
        <div className="flex items-start gap-1">
          <p className="text-xs font-semibold text-gray-700 leading-snug">
            Give and get ${REFERRAL_CREDIT_USD} credits
          </p>
          <span className="shrink-0 mt-0.5">
            <InfoTooltip
              tip={`Share your link. Whoever signs up through it gets $${REFERRAL_CREDIT_USD} in free credits, which unlock as their payments reach that amount. The moment theirs unlock, $${REFERRAL_CREDIT_USD} opens for you too, on the same terms. There is no limit: every person you refer who converts earns you another $${REFERRAL_CREDIT_USD}.`}
              placement="bottom"
            />
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white border border-brand-200 px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100 transition"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy invite link"}
        </button>
      </div>
    </div>
  );
}
