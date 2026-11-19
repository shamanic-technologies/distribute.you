"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { slowServerReadOptions } from "@/lib/query-options";
import { getFunnelCampaignChanges } from "@/lib/api";
import {
  changePctWords,
  dayWords,
  inconclusiveWords,
  rateWords,
  verdictPill,
  whoWords,
  type CampaignChange,
  type VerdictTone,
} from "@/lib/campaign-changes";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * WHAT WE CHANGED ON A CAMPAIGN AND WHAT IT DID (owner 2026-11-18, CAMPAIGN-CHANGE-LOG-1119): one line per change,
 * newest first: the day, the change in words, who made it, and its measured result on the named step with the
 * verdict. Failures show like successes. Off features-service's `changes`; every rate, change % and verdict is
 * served, nothing is divided, summed or judged here.
 */

const TONE_COLOR: Record<VerdictTone, string | null> = {
  good: "var(--run)",
  partial: "var(--data-amber)",
  bad: "var(--data-rose)",
  neutral: null,
};

const toneStyle = (tone: VerdictTone, fill: number) => {
  const c = TONE_COLOR[tone];
  return c
    ? { background: `color-mix(in oklab, ${c} ${fill}%, var(--bg-raised))`, color: "var(--fg-1)", boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 40%, transparent)` }
    : { background: "var(--bg-inset)", color: "var(--fg-2)", boxShadow: "inset 0 0 0 1px var(--line-subtle)" };
};

export function CampaignChanges({ brandId, campaignId }: { brandId: string; campaignId: string }) {
  const q = useAuthQuery(["campaignChanges", brandId, campaignId], () => getFunnelCampaignChanges(brandId, campaignId), slowServerReadOptions);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const data = q.data ?? null;
  // Pages read with « Load more », kept under the first page while it polls.
  const [more, setMore] = useState<{ changes: CampaignChange[]; nextCursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);

  const firstIds = new Set(data?.changes.map((c) => c.id) ?? []);
  const rows = [...(data?.changes ?? []), ...(more?.changes.filter((c) => !firstIds.has(c.id)) ?? [])];
  const cursor = more ? more.nextCursor : (data?.nextCursor ?? null);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const page = await getFunnelCampaignChanges(brandId, campaignId, cursor);
      setMore((prev) => ({ changes: [...(prev?.changes ?? []), ...page.changes], nextCursor: page.nextCursor }));
    } catch (err) {
      console.error("[campaign-changes] load more failed", { brandId, campaignId, cursor, err });
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section>
      <SectionTitle count={data?.total ?? null} right={<span>What we tried and what it did</span>}>
        Changes
      </SectionTitle>
      {!settled ? (
        <div className="k-card overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="k-line-subtle border-b px-4 py-3 last:border-b-0">
              <Shimmer className="h-[38px] w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="k-card">
          <EmptyNote>Could not read the changes right now. Retrying.</EmptyNote>
        </div>
      ) : rows.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No change yet. Each one we make shows here with its result.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <ul>
            {rows.map((c) => (
              <ChangeRow key={c.id} change={c} referenceIso={data.computedAt} />
            ))}
          </ul>
          {(cursor || moreFailed) && (
            <div className="k-fg3 k-line-subtle flex items-center justify-end gap-3 border-t px-4 py-2.5 text-[12px]">
              {moreFailed && <span>Could not load more. Try again.</span>}
              {cursor && (
                <button type="button" onClick={loadMore} disabled={loadingMore} className="k-btn-ghost">
                  {loadingMore ? "Loading" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ChangeRow({ change, referenceIso }: { change: CampaignChange; referenceIso: string }) {
  const r = change.result;
  const pill = verdictPill(r, referenceIso);
  const who = whoWords(change.who);
  const day = dayWords(change.date, referenceIso);
  const before = rateWords(r.before?.rate ?? null);
  const after = rateWords(r.after?.rate ?? null);
  const delta = changePctWords(r.changePct);
  const hasRates = r.step != null && (before != null || after != null);
  return (
    <li className="k-line-subtle grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[24px_56px_minmax(0,1fr)_auto] sm:items-start">
      <span className="mt-[1px] flex h-6 w-6 items-center justify-center rounded-md" style={toneStyle(pill.tone, 16)} aria-hidden>
        <VerdictGlyph verdict={r.verdict} />
      </span>
      <span className="k-mono k-fg2 hidden pt-[3px] text-[12px] tabular-nums sm:block">{day}</span>
      <div className="min-w-0">
        <p className="text-[13px] leading-[20px]">{change.summary}</p>
        <p className="k-fg3 mt-0.5 text-[12px] leading-[18px]">
          <span className="sm:hidden">{day}</span>
          {who && (
            <>
              <span className="sm:hidden"> · </span>
              {who}
            </>
          )}
        </p>
        {hasRates && r.step && (
          <p className="k-fg2 mt-1 text-[12px] leading-[18px] tabular-nums">
            {r.step.label}: {before ?? <span className="k-fg4">—</span>} → <span className="k-fg font-medium">{after ?? <span className="k-fg4">—</span>}</span>
            {delta && <span className="k-fg3"> ({delta})</span>}
          </p>
        )}
        {!hasRates && r.step && r.verdict === "too_early" && <p className="k-fg3 mt-1 text-[12px] leading-[18px]">Result tracked on {r.step.label}.</p>}
        {r.verdict === "inconclusive" && <p className="k-fg3 mt-1 text-[12px] leading-[18px]">{inconclusiveWords(r.verdictReason)}</p>}
        <span className="mt-2 inline-flex h-5 items-center rounded-md px-1.5 text-[12px] sm:hidden" style={toneStyle(pill.tone, 12)}>
          {pill.label}
        </span>
      </div>
      <span className="hidden h-5 items-center whitespace-nowrap rounded-md px-1.5 text-[12px] sm:inline-flex" style={toneStyle(pill.tone, 12)}>
        {pill.label}
      </span>
    </li>
  );
}

/** The verdict as a small glyph in its tile: a check, a cross, a clock, or a dash. */
function VerdictGlyph({ verdict }: { verdict: CampaignChange["result"]["verdict"] }) {
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (verdict === "worked" || verdict === "partial")
    return (
      <svg {...common}>
        <path d="M2.5 6.2 5 8.6 9.5 3.6" />
      </svg>
    );
  if (verdict === "did_not_work")
    return (
      <svg {...common}>
        <path d="M3 3l6 6M9 3 3 9" />
      </svg>
    );
  if (verdict === "too_early")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="4.2" />
        <path d="M6 3.8V6l1.5 1" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M3 6h6" />
    </svg>
  );
}
