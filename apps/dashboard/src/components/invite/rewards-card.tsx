"use client";

import { useEffect, useRef, useState } from "react";
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
import { Toast } from "@/components/toast";
import { formatBillingCentsWhole } from "@/lib/format-number";
import { REFERRAL_CREDIT_USD, inviteLinkForCode } from "@/lib/invite-link";
import {
  promiseProgressSentence,
  promiseProgressWidth,
  promiseUnlockLine,
} from "@/lib/free-credit-promise-view";

/**
 * The two rewards at the bottom of every brand-level sidebar, as two cards.
 *
 * They are separate on purpose. The invite line is a THING TO DO: one row, one
 * click. The card under it is a STATE: money already committed to this org, and
 * how close it is to landing. Folding them into one box made the doing read as a
 * footnote of the watching.
 *
 * ## The invite row
 *
 * One line, no button. A button inside a 224px rail spends a second line on a
 * control whose whole content is "click me", and the row already is the control.
 * The confirmation moved to a toast because a one-line row has nowhere to put a
 * "Copied" label. It is a `role="button"` div rather than a `<button>` so the
 * tooltip beside it stays legal markup: the repo's tooltip is itself a
 * `role="button"` span, and a real button would nest one interactive element
 * inside another.
 *
 * The link carries this org's real invite code, so a signup through it is
 * actually attributed. An earlier version copied a bare landing URL with a UTM
 * parameter and no backend at all, which credited nobody while promising credits
 * on screen. No code, no row.
 *
 * ## The promise card
 *
 * A PROMISE is money billing has committed to but not granted: it unlocks once
 * cumulative payments reach a bar billing froze when the promise was created. It
 * is deliberately NOT in `balance` or `credited`, so nothing here double-counts
 * against the figures on Billing.
 *
 * The heading states what is coming; the bar and the (i) beside it describe the
 * NEAREST promise, because that is the one the customer's next payment moves.
 * billing returns them cheapest-bar-first, so the first row is that one. The rest
 * are not listed: a list of four promises in a 224px rail is a ledger, and the
 * ledger is the Billing page this card links to.
 *
 * The unlock sentence sits behind the (i) rather than under the bar: it names a
 * second dollar figure, and two figures stacked in a 224px rail read as an amount
 * owed beside the amount coming. The heading now says what the money IS ("Free
 * $347 credits"), so the sentence is the detail, not the statement.
 *
 * That split is the goal-gradient reading (Hull; Kivetz and Nunes on endowed
 * progress, and every loyalty counter that says "16 stars until your next
 * reward"): one goal in view, stated as what is LEFT rather than as a total, over
 * a bar that is already partly filled, with the prize named above it so the
 * effort has a size.
 *
 * Every number is served and the words come from `lib/free-credit-promise-view`,
 * the same module the Billing rows read, so a promise cannot say one thing here
 * and another there.
 */

/**
 * The heading's amount.
 *
 * billing serves the total still outstanding across every promise, summed on the
 * same basis and in the same units as the rows it ships alongside, so the heading
 * and the list cannot state different figures. Summing them here instead would be
 * the compute-a-stat-in-the-browser bug, and it is what would let this heading
 * disagree with Billing.
 *
 * A body that predates that field falls back to the NEAREST promise, which is
 * true, is what shipped before, and understates rather than invents. `null` is
 * never rendered as a total: an absent total is not a zero.
 */
function headlineCents(totalCents: string | null, next: FreeCreditPromise): string {
  return totalCents ?? next.amountCents;
}

/** The nearest promise: what is coming, how close, and what the next payments open. */
function NextPromise({
  promise,
  totalCents,
  billingHref,
}: {
  promise: FreeCreditPromise;
  totalCents: string | null;
  billingHref: string;
}) {
  const width = promiseProgressWidth(promise.progressPct);
  // Stated under the bar so the same visit tomorrow is comparable to today's: a
  // shape cannot be remembered, a number can. It carries the ask alongside the
  // reading, so the bar is a goal rather than a gauge. Read from the same served
  // progress the bar is drawn from, so the two can never disagree. Its own line,
  // because the sentence does not fit beside a bar in a 224px rail.
  const progressLine = promiseProgressSentence(promise.progressPct);
  const remaining = promise.remainingToUnlockCents
    ? formatBillingCentsWhole(promise.remainingToUnlockCents)
    : null;

  return (
    <Link
      href={billingHref}
      className="block space-y-1.5 rounded-lg border border-brand-200 bg-brand-50 p-3 transition hover:bg-brand-100"
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 leading-snug">
        <span aria-hidden="true">🎁</span>
        <span className="min-w-0">
          {formatBillingCentsWhole(headlineCents(totalCents, promise))} credits on the way
        </span>
        <span className="ml-auto shrink-0">
          <InfoTooltip
            tip={promiseUnlockLine(formatBillingCentsWhole(promise.amountCents), remaining)}
            placement="bottom"
          />
        </span>
      </p>
      {width !== null && (
        <div className="space-y-1">
          <div className="h-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
          </div>
          {progressLine && (
            <p className="text-[10px] font-semibold tabular-nums text-brand-700">{progressLine}</p>
          )}
        </div>
      )}
    </Link>
  );
}

export function RewardsCard() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  // The toast outlives the click, so its timer is cleared on unmount: navigating
  // away mid-toast would otherwise set state on a component that is gone.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

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
    outstandingTotalCents: string | null;
    promises: FreeCreditPromise[];
  }>(["freeCreditPromises"], () => getFreeCreditPromises());

  const next = promiseData?.promises?.[0] ?? null;

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
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-2 p-2">
      {link && (
        <div
          role="button"
          tabIndex={0}
          onClick={copy}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void copy();
            }
          }}
          // Sized to hold its sentence on ONE line inside a 224px rail, which is
          // the whole point of dropping the button: measured, not guessed (the
          // label needs 138px of the 152px the row leaves it).
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-2 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          <span aria-hidden="true" className="text-[13px] leading-none">
            🎁
          </span>
          <span className="min-w-0 truncate text-[11px] font-semibold text-gray-700">
            Give and get ${REFERRAL_CREDIT_USD} credits
          </span>
          <span className="ml-auto shrink-0">
            <InfoTooltip
              tip={`Click the row to copy your invite link. Whoever signs up through it gets $${REFERRAL_CREDIT_USD} in free credits, which unlock as their payments reach that amount. The moment theirs unlock, $${REFERRAL_CREDIT_USD} opens for you too, on the same terms. There is no limit: every person you refer who converts earns you another $${REFERRAL_CREDIT_USD}.`}
              placement="bottom"
            />
          </span>
        </div>
      )}
      {next && (
        <NextPromise
          promise={next}
          totalCents={promiseData?.outstandingTotalCents ?? null}
          billingHref={billingHref}
        />
      )}
      {copied && <Toast message="Referral link copied" />}
    </div>
  );
}
