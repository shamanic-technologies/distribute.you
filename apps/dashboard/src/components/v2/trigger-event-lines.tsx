"use client";

import { useEffect, useMemo } from "react";
import { getOfferTriggerEventsSummary } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { formatCount } from "@/lib/format-number";
import type { LegCatalogue } from "@/lib/legs";
import {
  recordedSinceText,
  skipReasonsText,
  skipReasonWords,
  triggerLinesFor,
  type TriggerLine,
} from "@/lib/trigger-events";
import { triggerGlyph } from "@/components/v2/campaign-mode";
import { Shimmer } from "@/components/v2/ui";

/**
 * Under an offer's campaign rows (owner 2026-10-09): one line per trigger its reactive
 * campaigns wait on, "[icon] Positive reply  fired 12 · ran 9 · skipped 3 (campaign off) ·
 * since Oct 9". Every figure is campaign-service's, since recording began (no window); a
 * trigger an ON campaign waits on with no event yet reads "fired 0", never dropped.
 */
export function TriggerEventLines({
  brandId,
  offerId,
  campaigns,
  catalogue,
}: {
  brandId: string;
  offerId: string;
  campaigns: ReadonlyArray<{ featureSlug: string; legKey: string; on: boolean }>;
  catalogue: LegCatalogue;
}) {
  const q = useAuthQuery(
    ["offerTriggerEventsSummary", brandId, offerId],
    () => getOfferTriggerEventsSummary(brandId, offerId),
    pollOptions,
  );
  const summary = q.data?.triggers;
  // Which triggers this table's campaigns name is known before the counts: the lines appear at once.
  const lines = useMemo(() => triggerLinesFor(campaigns, catalogue, summary ?? []), [campaigns, catalogue, summary]);
  useEffect(() => {
    if (q.isError && !q.data) console.error("[trigger-events] the offer's trigger counts could not be read", { offerId, error: q.error });
  }, [q.isError, q.data, q.error, offerId]);

  if (lines.length === 0) return null;
  return (
    <div className="k-line-subtle space-y-1.5 border-t px-4 py-2.5 text-[12px] tabular-nums">
      {q.isError && !q.data ? (
        <p className="k-fg2">Could not load how often the triggers fired. It retries when you come back to the page.</p>
      ) : !q.data ? (
        lines.map((l) => <Shimmer key={l.trigger.id} className="h-5 w-full max-w-[340px] rounded-[6px]" />)
      ) : (
        lines.map((l) => <Line key={l.trigger.id} line={l} recordedSince={q.data.recordedSince} />)
      )}
    </div>
  );
}

function Line({ line, recordedSince }: { line: TriggerLine; recordedSince: string | null }) {
  const { trigger, counts } = line;
  const Glyph = triggerGlyph(trigger.icon);
  const reasons = counts?.skippedByReason ?? [];
  const unknown = reasons.filter((r) => !skipReasonWords(r.reason).known).map((r) => r.reason);
  const missingIcon = !!trigger.icon && !Glyph;
  useEffect(() => {
    if (unknown.length > 0) console.error("[trigger-events] skip reason with no plain words", { trigger: trigger.id, unknown });
    if (missingIcon) console.error("[trigger-events] trigger icon token not mapped", trigger);
  }, [unknown.join(","), missingIcon, trigger]); // eslint-disable-line react-hooks/exhaustive-deps
  const why = counts && counts.skipped > 0 ? skipReasonsText(reasons) : null;
  return (
    <p className="k-fg2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5" title={trigger.description ?? undefined}>
      {Glyph && <Glyph size={14} weight="duotone" aria-hidden className="k-fg2 shrink-0" />}
      <span className="k-fg font-medium">{trigger.label}</span>
      <span>fired {formatCount(counts?.events ?? 0)}</span>
      {counts && counts.events > 0 && (
        <>
          <span className="k-fg3">·</span>
          <span>ran {formatCount(counts.ran)}</span>
          <span className="k-fg3">·</span>
          <span>
            skipped {formatCount(counts.skipped)}
            {why && <span className="k-fg3"> ({why})</span>}
          </span>
          {counts.pending > 0 && (
            <>
              <span className="k-fg3">·</span>
              <span>waiting {formatCount(counts.pending)}</span>
            </>
          )}
        </>
      )}
      <span className="k-fg3">·</span>
      <span className="k-fg3">{recordedSince ? `since ${recordedSinceText(recordedSince)}` : "not recorded yet"}</span>
    </p>
  );
}
