"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { VendorLogo } from "@/components/audit/provider-logo";
import { nextRenewalEvents, vendorConsole, type EstateDomain, type RenewalEvent } from "@/lib/estate-signals";
import { formatCents } from "@/lib/instantly-ops";
import { billedNative } from "@/lib/estate-usd";
import { utcDay } from "@/components/cold-email/primitives";
import { Skeleton } from "@/components/skeleton";

/**
 * Events — the next two dates that move money.
 *
 * A domain about to LAPSE and a domain about to RENEW ITSELF need opposite
 * actions, so they are two rows with two CTAs, never one "next renewal".
 *
 * The CTA links the vendor's console ROOT, not a per-domain page: Gandi's
 * console is a catch-all SPA, so a per-domain URL cannot be verified to exist
 * and a CTA that 404s after a login is worse than one that lands on the list.
 * The domain is named beside it so the operator knows what to look for.
 */

function EventRow({
  event,
  cta,
  note,
}: {
  event: RenewalEvent;
  cta: string;
  note: string;
}) {
  const vendor = vendorConsole(event.provider);
  // USD first (the served twin), the vendor's own figure beside it as provenance.
  // A priced renewal with no USD twin has no rate on record: say that, never
  // print the euro amount as if it were dollars.
  const price =
    event.renewalCents === null
      ? "no price on record"
      : event.renewalUsdCents === null
        ? "no USD rate on record"
        : formatCents(event.renewalUsdCents, "USD");
  const billed = billedNative(event.renewalCents, event.currency);
  return (
    <div className="border-b border-gray-100 py-3 last:border-0 last:pb-0 first:pt-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{note}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gray-900">
        <VendorLogo provider={event.provider} />
        <span className="truncate">{event.domain}</span>
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {utcDay(event.expiresAt)}
        {vendor ? ` · ${vendor.label}` : event.provider ? ` · ${event.provider}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {vendor ? (
          <a
            href={vendor.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            {cta}
            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
          </a>
        ) : (
          // No console on record for this vendor: say so rather than offering a
          // button that goes nowhere.
          <span className="text-xs text-gray-400">No console on record for this vendor.</span>
        )}
        <span className="text-[11px] tabular-nums text-gray-400">
          {price}
          {billed ? ` · ${billed}` : ""}
        </span>
      </div>
    </div>
  );
}

export function EstateEventsPanel({
  domains,
  isPending,
}: {
  domains: EstateDomain[];
  isPending: boolean;
}) {
  const { ending, renewing, unknownAutorenew } = nextRenewalEvents(domains);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">Events</h2>
      <p className="mt-1 text-xs text-gray-500">
        The next two dates that move money: one domain lapsing, one renewing itself.
      </p>

      <div className="mt-3">
        {isPending ? (
          <Skeleton className="h-40 w-full rounded" />
        ) : !ending && !renewing ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No live domain states an expiry date and an auto-renew direction.
          </p>
        ) : (
          <>
            {ending && (
              <EventRow
                event={ending}
                cta="Renew now"
                note="Next to end (will not auto-renew)"
              />
            )}
            {renewing && (
              <EventRow
                event={renewing}
                cta="Cancel auto-renew"
                note="Next to auto-renew (you will be charged)"
              />
            )}
          </>
        )}
      </div>

      {!isPending && unknownAutorenew > 0 && (
        // Neither bucket: a domain whose vendor never stated a direction is not
        // "will renew" and not "will lapse", so it is counted rather than
        // silently filed on one side.
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-amber-600">
          {unknownAutorenew.toLocaleString("en-US")} live domain
          {unknownAutorenew === 1 ? " states" : "s state"} no auto-renew direction at all, so
          neither row can speak for {unknownAutorenew === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}
