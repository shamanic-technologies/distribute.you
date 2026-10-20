"use client";

import { useState } from "react";
import { clearMonthlyChargeLimit, getMonthlyChargeLimit, setMonthlyChargeLimit, type MonthlyChargeLimit } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { formatCentsAsUsd } from "@/lib/format-number";
import { parseMonthlyLimitUsd } from "@/lib/v2/monthly-limit";
import { Meter, Shimmer } from "@/components/v2/ui";

/**
 * The monthly limit on Billing (owner 2026-10-21): a cap on what the org's campaigns SPEND in a
 * month. billing-service stops campaign runs at it and never refuses a charge, so the bar reads
 * the served spend of the month (`spent_this_period_cents`), never card charges. The "limit
 * reached" email links here. The amount reads as text, a click turns it into its
 * field, leaving it saves, Esc drops it (v2 inline edit).
 */
export function MonthlyLimitCard() {
  const queryClient = useQueryClient();
  const { data, isFetchedAfterMount, isError } = useAuthQuery(["monthlyChargeLimit"], () => getMonthlyChargeLimit());
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function write(next: number | null) {
    setText(null);
    setError(null);
    setPending(next);
    try {
      const saved: MonthlyChargeLimit = next === null ? await clearMonthlyChargeLimit() : await setMonthlyChargeLimit(next * 100);
      queryClient.setQueryData(["monthlyChargeLimit"], saved);
    } catch (err) {
      console.error("[billing v2] monthly limit save failed:", err);
      if (next !== null) setText(String(next));
      setError("Not saved. Try again.");
    } finally {
      setPending(undefined);
    }
  }

  function commit() {
    if (text === null) return;
    const parsed = parseMonthlyLimitUsd(text, 1);
    if ("problem" in parsed) {
      setError(parsed.problem);
      return;
    }
    void write(parsed.usd);
  }

  if (!data && !isFetchedAfterMount) return <Shimmer className="h-20" />;
  if (!data) {
    return <p className="k-fg3 text-[12px]">{isError ? "We could not read your monthly limit right now." : "Loading your monthly limit."}</p>;
  }

  const limitCents = pending !== undefined ? (pending === null ? null : pending * 100) : data.monthly_charge_limit_cents;
  // Decimal-cents string from billing; absent only while billing v0.83.48 rolls out.
  const spentRaw = data.spent_this_period_cents;
  const spent = spentRaw === null || spentRaw === undefined ? null : Number(spentRaw);
  const editing = text !== null;

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        {limitCents === null && !editing ? (
          <>
            <span className="k-fg">No monthly spend limit.</span>
            <button type="button" onClick={() => setText("")} className="k-hover k-accent-text rounded-[6px] px-1.5 font-medium">
              Set a limit
            </button>
          </>
        ) : (
          <>
            <span className="k-fg">Never spend more than</span>
            {editing ? (
              <span className="inline-flex items-center gap-1">
                <span className="k-fg2">$</span>
                <input
                  autoFocus
                  inputMode="numeric"
                  aria-label="Monthly spend limit in dollars"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setText(null);
                      setError(null);
                    }
                  }}
                  className="k-input w-24 text-right tabular-nums"
                  style={{ font: "inherit", paddingRight: 8 }}
                />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setText(limitCents === null ? "" : String(Math.round(limitCents / 100)))}
                className="k-hover rounded-[6px] px-1.5 font-medium tabular-nums"
              >
                {formatCentsAsUsd(limitCents ?? 0, 0)}
              </button>
            )}
            <span className="k-fg">per month</span>
          </>
        )}
        {limitCents !== null && !editing && (
          <button type="button" className="k-btn-ghost ml-auto" disabled={pending !== undefined} onClick={() => void write(null)}>
            Remove limit
          </button>
        )}
      </div>
      {limitCents !== null && spent !== null && Number.isFinite(spent) && (
        <div className="mt-3">
          <Meter value={spent} max={limitCents} />
          <p className="k-fg3 mt-1.5 flex justify-between gap-3 text-[12px] tabular-nums">
            <span>
              {formatCentsAsUsd(spent)} of {formatCentsAsUsd(limitCents, 0)} spent this month
            </span>
            {pending === undefined && data.remaining_cents !== null && <span>{formatCentsAsUsd(data.remaining_cents)} left</span>}
          </p>
        </div>
      )}
      {data.limit_reached && pending === undefined && (
        <p className="mt-2 text-[13px] text-[var(--data-amber)]">
          Your campaigns stopped at your monthly limit. Raise it to start them again.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--data-rose)]">
          {error}
        </p>
      )}
    </div>
  );
}
