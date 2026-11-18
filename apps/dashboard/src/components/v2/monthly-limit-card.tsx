"use client";

import { useState } from "react";
import { clearMonthlyChargeLimit, getMonthlyChargeLimit, setMonthlyChargeLimit, type MonthlyChargeLimit } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { formatCentsAsUsd } from "@/lib/format-number";
import { parseMonthlyLimitUsd } from "@/lib/v2/monthly-limit";
import { Meter, Shimmer } from "@/components/v2/ui";
import { DollarField } from "@/components/v2/get-started/prepaid-topup";
import { SettingButton, SettingModal } from "@/components/v2/setting-modal";

/**
 * The calendar month billing counts (`period_start`, UTC), by name. "This month" sat
 * under a Balance card counting since the last charge, so $79.95 read as a third
 * figure for the same money (2026-11-02): a hold made in October counts in October.
 */
function periodMonth(periodStart: string): string {
  const at = new Date(periodStart);
  if (Number.isNaN(at.getTime())) {
    console.error("[billing v2] monthly limit period_start is not a date:", periodStart);
    return "this month";
  }
  return at.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

/**
 * The monthly limit on Billing (owner 2026-10-21): a cap on what the org's campaigns SPEND in a
 * month. billing-service stops campaign runs at it and never refuses a charge, so the bar reads
 * the served spend of the month (`spent_this_period_cents`), never card charges. The "limit
 * reached" email links here. Its value reads in a `SettingButton` and changes in a
 * `SettingModal`, exactly like the auto top-up beside it (owner 2026-11-18: every money setting
 * on Billing opens, saves and refuses the same way).
 */
export function MonthlyLimitCard() {
  const { data, isFetchedAfterMount, isError } = useAuthQuery(["monthlyChargeLimit"], () => getMonthlyChargeLimit());
  const [open, setOpen] = useState(false);

  if (!data && !isFetchedAfterMount) return <Shimmer className="h-20" />;
  if (!data) {
    return <p className="k-fg3 text-[12px]">{isError ? "We could not read your monthly limit right now." : "Loading your monthly limit."}</p>;
  }

  const limitCents = data.monthly_charge_limit_cents;
  // Decimal-cents string from billing; absent only while billing v0.83.48 rolls out.
  const spentRaw = data.spent_this_period_cents;
  const spent = spentRaw === null || spentRaw === undefined ? null : Number(spentRaw);
  const metered = limitCents !== null && spent !== null && Number.isFinite(spent);

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Monthly limit</p>
          <p className="k-fg3 mt-0.5 text-[12px] leading-[18px] tabular-nums">
            {limitCents === null
              ? "No limit. Your campaigns spend what your balance allows."
              : metered
                ? `${formatCentsAsUsd(spent)} of ${formatCentsAsUsd(limitCents, 0)} spent in ${periodMonth(data.period_start)}, provisioned included.`
                : `Your campaigns stop at ${formatCentsAsUsd(limitCents, 0)} in ${periodMonth(data.period_start)}.`}
          </p>
        </div>
        <SettingButton label="Change monthly limit" onClick={() => setOpen(true)}>
          {limitCents === null ? "No limit" : `${formatCentsAsUsd(limitCents, 0)}/month`}
        </SettingButton>
      </div>
      {metered && (
        <div className="mt-3">
          <Meter value={spent} max={limitCents} />
          {data.remaining_cents !== null && (
            <p className="k-fg3 mt-1.5 text-right text-[12px] tabular-nums">{formatCentsAsUsd(data.remaining_cents)} left</p>
          )}
        </div>
      )}
      {data.limit_reached && (
        <p className="mt-2 text-[13px] text-[var(--data-amber)]">
          Your campaigns stopped at your monthly limit. Raise it to start them again.
        </p>
      )}
      {open && <MonthlyLimitModal limitCents={limitCents} onClose={() => setOpen(false)} />}
    </div>
  );
}

function MonthlyLimitModal({ limitCents, onClose }: { limitCents: number | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [limitOn, setLimitOn] = useState(true);
  const [text, setText] = useState(limitCents === null ? "" : String(Math.round(limitCents / 100)));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const parsed = limitOn ? parseMonthlyLimitUsd(text, 1) : null;
  const next = parsed === null ? null : "usd" in parsed ? parsed.usd : undefined;
  const changed = next !== undefined && (next === null ? limitCents !== null : next * 100 !== limitCents);

  async function save() {
    if (next === undefined) return;
    setSaving(true);
    setFailure(null);
    try {
      const saved: MonthlyChargeLimit = next === null ? await clearMonthlyChargeLimit() : await setMonthlyChargeLimit(next * 100);
      queryClient.setQueryData(["monthlyChargeLimit"], saved);
    } catch (err) {
      console.error("[billing v2] monthly limit save failed:", err);
      setFailure("Not saved. Try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
    onClose();
  }

  return (
    <SettingModal title="Monthly limit" onClose={onClose} onSave={() => void save()} saving={saving} canSave={changed} failure={failure}>
      <div className="grid gap-3">
        <div>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={limitOn}
              onChange={(e) => {
                setLimitOn(e.target.checked);
                setFailure(null);
              }}
              disabled={saving}
            />
            <span className="k-fg font-medium">Limit my monthly spend</span>
          </label>
          {limitOn && (
            <div className="mt-2 flex flex-wrap items-start gap-4">
              <DollarField
                label="Never spend more than, per month"
                value={text}
                onChange={(v) => {
                  setText(v);
                  setFailure(null);
                }}
                problem={parsed && "problem" in parsed && text.trim() !== "" ? parsed.problem : null}
                disabled={saving}
              />
            </div>
          )}
        </div>
        <p className="k-fg3 text-[12px] leading-[18px]">
          {limitOn
            ? "Your campaigns stop once they spend this much in a calendar month. Raise it anytime to start them again."
            : "Your campaigns spend what your balance allows."}
        </p>
      </div>
    </SettingModal>
  );
}
