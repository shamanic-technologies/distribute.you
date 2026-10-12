"use client";

import { useState } from "react";
import { clearMonthlyChargeLimit, getMonthlyChargeLimit, setMonthlyChargeLimit, type MonthlyChargeLimit } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { formatCentsAsUsd } from "@/lib/format-number";
import { parseMonthlyLimitUsd } from "@/lib/v2/monthly-limit";
import { Meter, Shimmer } from "@/components/v2/ui";

/**
 * The monthly charge limit on Billing (owner 2026-10-12: "whatever happens, my card is never
 * charged more than $X a month"). billing-service holds it and counts this month's charges;
 * the "limit reached" email links here. The amount reads as text, a click turns it into its
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
  const charged = data.charged_this_period_cents;

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="k-fg">Never charge me more than</span>
        {text !== null ? (
          <span className="inline-flex items-center gap-1">
            <span className="k-fg2">$</span>
            <input
              autoFocus
              inputMode="numeric"
              aria-label="Monthly charge limit in dollars"
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
            {limitCents === null ? <span className="k-accent-text">set a limit</span> : formatCentsAsUsd(limitCents, 0)}
          </button>
        )}
        <span className="k-fg">a month</span>
        {limitCents !== null && text === null && (
          <button type="button" className="k-btn-ghost ml-auto" disabled={pending !== undefined} onClick={() => void write(null)}>
            Remove limit
          </button>
        )}
      </div>
      {limitCents !== null && charged !== null && (
        <div className="mt-3">
          <Meter value={charged} max={limitCents} />
          <p className="k-fg3 mt-1.5 text-[12px] tabular-nums">
            {formatCentsAsUsd(charged, 0)} of {formatCentsAsUsd(limitCents, 0)} charged this month
          </p>
        </div>
      )}
      {data.limit_reached && pending === undefined && (
        <p className="mt-2 text-[13px] text-[var(--data-amber)]">
          Your campaigns stopped: the next charge would go over your limit. Raise it to start them again.
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
