"use client";

import { ProviderLogo } from "@/components/provider-logo";
import { getLeadWrittenBy } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { writtenByForRow, writtenWithTags, type WrittenBy } from "@/lib/written-by";

/**
 * What the messages we sent one person were written with (features-service, `lib/written-by.ts`).
 * Read on open, not polled: the producer walks the pipe rankings, which can take seconds a call,
 * and a row only appears when a message is sent.
 */
export function useLeadWrittenBy(leadId: string | null | undefined): WrittenBy | null {
  const q = useAuthQuery(["leadWrittenBy", leadId], () => getLeadWrittenBy(leadId!), { enabled: Boolean(leadId) });
  // Only THIS person's read: the app-wide placeholder would hand a re-keyed read the last person's.
  if (!leadId || q.isPlaceholderData || !q.data || q.data.leadId !== leadId) return null;
  return q.data;
}

/**
 * Discreet tags beside a message's label (owner 2026-10-19): "Written with", the model (product
 * logo + name) and each tactic's name, its client line on hover. Matched on the message's own id
 * (`messageId`, lead-service's), the campaign entry only for a message with no served row.
 * Nothing when a person wrote it, the writer is unknown, or nothing is served (never a guess).
 */
export function WrittenWithTags({
  writtenBy,
  messageId,
  campaignId,
  at,
}: {
  writtenBy: WrittenBy | null;
  messageId: string | null | undefined;
  campaignId: string | null | undefined;
  at: string | null | undefined;
}) {
  const tags = writtenWithTags(writtenByForRow(writtenBy, { id: messageId, campaignId, at }));
  if (!tags) return null;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-1" data-written-with>
      <span className="k-fg3 text-[12px]">Written with</span>
      {tags.model ? (
        <span className="k-chip" title={tags.model.name}>
          {tags.model.logoDomain ? <ProviderLogo domain={tags.model.logoDomain} size={12} className="shrink-0 rounded-[3px]" /> : null}
          {tags.model.label}
        </span>
      ) : null}
      {tags.tactics.map((t) => (
        <span key={t.name} className="k-chip" title={t.line}>
          {t.name}
        </span>
      ))}
    </span>
  );
}
