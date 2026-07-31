"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getFreeCreditPromises, type FreeCreditPromise } from "@/lib/api";
import { formatBillingCents } from "@/lib/format-number";
import { Skeleton } from "@/components/skeleton";
import { BrandLogo } from "@/components/brand-logo";
import {
  isEarnedByReferral,
  promiseProgressWidth,
  promiseSubtitle,
  promiseTitle,
} from "@/lib/free-credit-promise-view";

/**
 * Free credits this org is still waiting on, under the gifts it has already had.
 *
 * The distinction the card exists to draw: a **gift** is money already in the
 * balance, a **promise** is money committed but not granted, which unlocks once
 * cumulative payments reach a bar billing froze when the promise was created.
 * billing keeps promises out of `credited` / `balance` / spendable, so nothing
 * here double-counts against the figures above it.
 *
 * A customer can hold several at once: the welcome remainder, plus a $500 promise
 * for each referral that converts. Rows arrive cheapest-bar-first from billing and
 * are rendered in that order, so the next one to land reads first.
 *
 * Every number is served (amount, remaining, progress). Nothing is computed here.
 */

// A promise earned by a referral names the org that earned it. The logo is keyed
// on that org's DOMAIN, exactly like every other logo in the dashboard; the name
// is a separate value and the two must not be collapsed (a logo.dev lookup on a
// company NAME resolves nothing, so passing the label as the domain empties the
// slot with no error anywhere).
function PromiseMark({ promise }: { promise: FreeCreditPromise }) {
  if (!isEarnedByReferral(promise) || !promise.referredOrgDomain) return null;
  return (
    <span className="shrink-0">
      <BrandLogo domain={promise.referredOrgDomain} size={28} className="rounded" />
    </span>
  );
}

function PromiseRow({ promise }: { promise: FreeCreditPromise }) {
  const width = promiseProgressWidth(promise.progressPct);
  const remaining = promise.remainingToUnlockCents
    ? formatBillingCents(promise.remainingToUnlockCents)
    : null;

  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PromiseMark promise={promise} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800">{promiseTitle(promise)}</p>
            <p className="text-xs text-gray-500">{promiseSubtitle(remaining)}</p>
          </div>
        </div>
        <span className="whitespace-nowrap text-sm font-semibold text-gray-500">
          {formatBillingCents(promise.amountCents)}
        </span>
      </div>
      {width !== null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
        </div>
      )}
    </li>
  );
}

export function ComingCreditsCard() {
  const { data, isPending, isError } = useAuthQuery<{
    paidTopupsCents: string;
    promises: FreeCreditPromise[];
  }>(["freeCreditPromises"], () => getFreeCreditPromises());

  const promises = data?.promises ?? [];

  // An org with nothing coming should see nothing, not an empty card telling it
  // so. Reveal-on-settle: a failed read renders nothing rather than an eternal
  // skeleton, and the error is already loud in the console via the reader.
  if (!isPending && (isError || promises.length === 0)) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-1 flex items-center gap-2">
        <svg className="h-5 w-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 className="text-lg font-medium text-gray-900">On the way</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">
        Free credits you have earned but not received yet. They land as your payments reach each
        amount, and are not part of your balance until they do.
      </p>

      {isPending && promises.length === 0 ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-1 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {promises.map((p) => (
            <PromiseRow key={p.id} promise={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
