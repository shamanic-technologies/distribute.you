"use client";

import { ProviderLogo } from "@/components/provider-logo";
import { getLeadWrittenBy } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { hasWrittenBy, vendorDomain, writtenByForMessage, type WrittenByEntry } from "@/lib/written-by";

/**
 * Who wrote the messages we sent to one person (features-service, `lib/written-by.ts`).
 * Read on open, not polled: the producer walks the pipe rankings to say "under test", which
 * can take seconds a call, and an entry only appears when a new sequence is written.
 */
export function useLeadWrittenBy(leadId: string | null | undefined): readonly WrittenByEntry[] | null {
  const q = useAuthQuery(["leadWrittenBy", leadId], () => getLeadWrittenBy(leadId!), { enabled: Boolean(leadId) });
  // Only THIS person's entries: the app-wide placeholder would hand a re-keyed read the last person's.
  if (!leadId || q.isPlaceholderData || !q.data || q.data.leadId !== leadId) return null;
  return q.data.entries;
}

/**
 * Under one message we sent: the model that wrote it (vendor logo + name), "Under test" while
 * the version that wrote it is still tested, then the plain tactic lines. Nothing at all when
 * no entry is served for the message (owner 2026-10-19: never a guess).
 */
export function WrittenByLine({
  entries,
  campaignId,
  at,
}: {
  entries: readonly WrittenByEntry[] | null;
  campaignId: string | null | undefined;
  at: string | null | undefined;
}) {
  const entry = entries ? writtenByForMessage(entries, { campaignId, at }) : null;
  if (!hasWrittenBy(entry)) return null;
  const domain = entry.model ? vendorDomain(entry.model.vendor.id) : null;
  return (
    <div className="k-line-subtle mt-2 border-t pt-2 text-[12px] leading-[18px]" data-written-by>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="k-label">Written by</span>
        {entry.model ? (
          <span className="inline-flex items-center gap-1.5">
            {domain ? <ProviderLogo domain={domain} size={14} className="shrink-0 rounded-[3px]" /> : null}
            <span className="font-medium" title={entry.model.vendor.name}>
              {entry.model.name}
            </span>
          </span>
        ) : null}
        {entry.underTest === true ? <span className="k-chip">Under test</span> : null}
      </p>
      {entry.tactics.length > 0 ? (
        <ul className="k-fg2 mt-1 space-y-0.5">
          {entry.tactics.map((t) => (
            <li key={t.line} className="flex gap-1.5">
              <span className="k-fg4" aria-hidden>
                ·
              </span>
              <span className="min-w-0">{t.line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
