"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingAccount,
  getFreeCreditPromises,
  getInviteStatus,
  type BillingAccount,
  type FreeCreditPromise,
  type InviteStatus,
} from "@/lib/api";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { formatBillingCents } from "@/lib/format-number";
import { REFERRAL_CREDIT_USD, inviteLinkForCode } from "@/lib/invite-link";
import { promiseProgressWidth, promiseSubtitle } from "@/lib/free-credit-promise-view";

/**
 * The rewards card, anchored at the bottom of every brand-level sidebar.
 *
 * Two halves of one offer, in the order a customer meets them: the free credits
 * already earned and now unlocking as they spend, then the link that earns more.
 * They were two adjacent cards for a while and read as two products; a reader
 * comparing them had to hold "money already committed to me" and "money I could
 * earn" as separate ideas when they are the same reward ladder.
 *
 * ## What the top half is
 *
 * A PROMISE is money billing has committed to but not granted: it unlocks once
 * cumulative payments reach a bar billing froze when the promise was created. It
 * is deliberately NOT in `balance` or `credited`, so nothing here double-counts
 * against the figures on Billing.
 *
 * Only the NEAREST promise is shown. billing returns them cheapest-bar-first, so
 * the first row is the next one to land; the rest are counted, not listed. That
 * is the goal-gradient reading (Kivetz/Nunes, and every loyalty counter that
 * says "16 stars until your next reward"): one goal in view, stated as what is
 * LEFT rather than as a total, over a bar that is already partly filled. A list
 * of four promises in a 224px column is a ledger, and the ledger is on Billing,
 * which this half links to.
 *
 * Every number is served (amount, remaining, progress) and the words come from
 * `lib/free-credit-promise-view`, the same module the Billing rows read, so a
 * promise cannot say one thing here and another there.
 *
 * ## What the bottom half is
 *
 * The link carries this org's real invite code, so a signup through it is
 * actually attributed. An earlier version copied a bare landing URL with a UTM
 * parameter and no backend at all, which credited nobody while promising credits
 * on screen. If the code cannot be read, that half renders nothing rather than
 * offering a link that leads to no reward.
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

/**
 * The nearest promise, as one line, a bar and a sentence.
 *
 * The heading leads with the AMOUNT because that is the reward; the sentence
 * under the bar states what is left to unlock it, which is the number that moves
 * when the customer spends. The bar renders only when the producer measured a
 * progress: a zeroed bar for an unmeasurable promise reads as "you have paid
 * nothing", which is a claim we would be inventing.
 */
function NextPromise({
  promise,
  othersCount,
  billingHref,
}: {
  promise: FreeCreditPromise;
  othersCount: number;
  billingHref: string;
}) {
  const width = promiseProgressWidth(promise.progressPct);
  const remaining = promise.remainingToUnlockCents
    ? formatBillingCents(promise.remainingToUnlockCents)
    : null;

  return (
    <Link href={billingHref} className="block space-y-1.5 rounded-md -m-1 p-1 transition hover:bg-brand-100">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700 leading-snug">
          {formatBillingCents(promise.amountCents)} on the way
        </p>
        {othersCount > 0 && (
          <span className="shrink-0 text-[10px] font-medium text-gray-500">
            +{othersCount} more
          </span>
        )}
      </div>
      {width !== null && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
        </div>
      )}
      <p className="text-[11px] leading-snug text-gray-600">{promiseSubtitle(remaining)}</p>
    </Link>
  );
}

export function RewardsCard() {
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();

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

  // Same key the Billing page polls, so the two dedupe to one request and the
  // card paints from disk on the first frame.
  const { data: promiseData } = useAuthQuery<{
    paidTopupsCents: string;
    promises: FreeCreditPromise[];
  }>(["freeCreditPromises"], () => getFreeCreditPromises());

  const promises = promiseData?.promises ?? [];
  const next = promises[0] ?? null;

  // The Billing link reads the org from the URL, which is the per-tab source of
  // truth for the whole dashboard (a Clerk active org flips across tabs). Same
  // segment the sidebar itself builds its links from.
  const billingHref = `/orgs/${pathname.split("/")[2] ?? ""}/billing`;

  const link = inviteLinkForCode(invite?.code);

  // Nothing earned and no link to earn with is nothing to say.
  if (!next && !link) return null;

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-2">
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 space-y-2.5">
        {next && (
          <NextPromise
            promise={next}
            othersCount={promises.length - 1}
            billingHref={billingHref}
          />
        )}
        {next && link && <div className="border-t border-brand-200" />}
        {link && (
          <div className="space-y-2">
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
        )}
      </div>
    </div>
  );
}
