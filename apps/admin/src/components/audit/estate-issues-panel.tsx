"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  domainIssues,
  groupIssues,
  liveDomains,
  type EstateDomain,
  type IssueGroup,
  type IssueKind,
} from "@/lib/estate-signals";
import { Skeleton } from "@/components/skeleton";

/**
 * Issues — what is broken, ONE ROW PER KIND, most urgent first.
 *
 * ⚠️ Grouped rather than flat, and that is measured rather than tidy. A rule
 * that fires on most of the estate is not a finding, it is a description of the
 * fleet, and flat it BURIES the findings that are rare: on 2026-09-22 the live
 * estate carried 117 findings over 74 domains, of which 61 were "fewer than
 * five mailboxes" (Primeforge sells three-mailbox domains, so that is its
 * normal shape) and 36 were one recovery wave. The four missing-DMARC domains
 * sat above 113 rows nobody would scroll.
 *
 * Nothing is dropped: every domain is named under its kind, and a chip opens
 * that domain's own slide-over.
 *
 * A domain the DNS sweep never probed carries NO finding — it is a domain we
 * know nothing about, not one with a problem — and the count of those is stated
 * separately. `domainIssues` enforces that; this panel only renders it.
 */

const KIND_TONE: Record<IssueKind, string> = {
  "dns-missing": "bg-red-500",
  reputation: "bg-red-500",
  "no-mailboxes": "bg-orange-500",
  "dns-weak": "bg-amber-500",
  "thin-mailboxes": "bg-sky-500",
  "mostly-recovering": "bg-sky-500",
  "dns-unread": "bg-gray-400",
};

const KIND_WORD: Record<IssueKind, string> = {
  "dns-missing": "DNS missing",
  reputation: "Reputation",
  "no-mailboxes": "Not sending",
  "dns-weak": "DNS weak",
  "thin-mailboxes": "Thin",
  "mostly-recovering": "In recovery",
  "dns-unread": "DNS unread",
};

/** How many domain chips a collapsed row names before it says "and N more". */
const CHIPS = 3;

function IssueGroupRow({
  group,
  onOpenDomain,
}: {
  group: IssueGroup;
  onOpenDomain?: (domain: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? group.domains : group.domains.slice(0, CHIPS);
  const hidden = group.domains.length - shown.length;

  return (
    <div className="border-b border-gray-100 py-2 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND_TONE[group.kind]}`} />
        <span className="text-xs font-medium text-gray-800">{KIND_WORD[group.kind]}</span>
        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-600">
          {group.domains.length.toLocaleString("en-US")}
        </span>
        <ChevronRightIcon
          className={`ml-auto h-3 w-3 shrink-0 text-gray-400 ${open ? "rotate-90" : ""}`}
        />
      </button>
      {/* The finding's own words, taken from a real domain rather than
          re-written per kind, so the line says what is actually wrong. */}
      <p className="mt-0.5 pl-3.5 text-[11px] text-gray-500">{group.sample.detail}</p>
      <div className="mt-1 flex flex-wrap gap-1 pl-3.5">
        {shown.map((domain) => (
          <button
            key={domain}
            type="button"
            onClick={() => onOpenDomain?.(domain)}
            className="max-w-full truncate rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
          >
            {domain}
          </button>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 hover:underline"
          >
            and {hidden.toLocaleString("en-US")} more
          </button>
        )}
      </div>
    </div>
  );
}

export function EstateIssuesPanel({
  domains,
  isPending,
  onOpenDomain,
}: {
  domains: EstateDomain[];
  isPending: boolean;
  onOpenDomain?: (domain: string) => void;
}) {
  const issues = domainIssues(domains);
  const groups = groupIssues(issues);
  const unprobed = liveDomains(domains).filter((d) => d.dns === null).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Issues</h2>
          <p className="mt-1 text-xs text-gray-500">
            One row per kind of finding, most urgent first. Open a row for every domain in it.
          </p>
        </div>
        {!isPending && issues.length > 0 && (
          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
            {issues.length.toLocaleString("en-US")}
          </span>
        )}
      </div>

      <div className="mt-3 max-h-[19rem] overflow-y-auto">
        {isPending ? (
          <Skeleton className="h-40 w-full rounded" />
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            Nothing to fix on the domains we have looked at.
          </p>
        ) : (
          groups.map((group) => (
            <IssueGroupRow key={group.kind} group={group} onOpenDomain={onOpenDomain} />
          ))
        )}
      </div>

      {!isPending && unprobed > 0 && (
        // Stated, never folded into either side: an unprobed domain is one we
        // know nothing about, not one with a clean bill of health.
        <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
          {unprobed.toLocaleString("en-US")} live domain
          {unprobed === 1 ? " has" : "s have"} never been DNS-probed, so nothing is known about{" "}
          {unprobed === 1 ? "its records" : "their records"} either way.
        </p>
      )}
    </div>
  );
}
