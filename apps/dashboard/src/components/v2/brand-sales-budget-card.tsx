"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { clearBrandSalesBudget, getBrandSalesBudget, setBrandSalesBudget } from "@/lib/api";
import { globalBudgetUsd, parseBudgetInput } from "@/lib/brand-sales-budget";
import { SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * The brand's ONE daily sales budget (beta). Stated, it replaces the per-mission
 * daily budgets for this brand: we spend it on the best-ROI sales path first.
 * Legs set off by a step (a positive reply, a booking call) always run while you
 * authorise them. Cleared, every mission is back on its own daily budget.
 * billing-service owns the mode; this reads and writes it.
 */
export function BrandSalesBudgetCard({ brandId }: { brandId: string }) {
  const qc = useQueryClient();
  const q = useAuthQuery(["brandSalesBudget", brandId], () => getBrandSalesBudget(brandId), { enabled: !!brandId });
  const current = globalBudgetUsd(q.data);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(current == null ? "" : String(current));
  }, [current]);

  const settled = q.data !== undefined || q.isError;
  const parsed = parseBudgetInput(text);
  const dirty = "cents" in parsed ? parsed.cents !== (current == null ? null : Math.round(current * 100)) : text.trim() !== "";

  const save = async () => {
    if (!("cents" in parsed)) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(["brandSalesBudget", brandId], await setBrandSalesBudget(brandId, parsed.cents));
    } catch (err) {
      console.error("[brand-sales-budget] save failed", err);
      setError("Could not save the budget. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    setError(null);
    try {
      qc.setQueryData(["brandSalesBudget", brandId], await clearBrandSalesBudget(brandId));
    } catch (err) {
      console.error("[brand-sales-budget] clear failed", err);
      setError("Could not switch back. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>Daily sales budget</SectionTitle>
      <div className="k-card space-y-3 p-4">
        <p className="k-fg2 text-[13px]">
          One budget for this whole brand. We spend it on the sales path with the best return first.
          Legs set off by a step, like a positive reply, always run while you keep them ticked.
        </p>
        {!settled ? (
          <Shimmer className="h-9 w-64 rounded-[8px]" />
        ) : (
          <>
            <p className="text-[13px]">
              {current == null
                ? "Now: each mission runs on its own daily budget."
                : `Now: $${current.toLocaleString("en-US")} a day for the whole brand.`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="k-input flex h-9 items-center gap-1 px-3">
                <span className="k-fg3 text-[13px]">$</span>
                <input
                  inputMode="numeric"
                  aria-label="Daily sales budget in dollars"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setError(null);
                  }}
                  className="w-24 bg-transparent text-right text-[13px] tabular-nums outline-none"
                  placeholder="0"
                />
                <span className="k-fg3 text-[13px]">/day</span>
              </label>
              {dirty && (
                <button type="button" disabled={busy} onClick={save} className="k-btn k-btn-accent h-9 px-3 text-[13px]">
                  {busy ? "Saving..." : current == null ? "Use one budget" : "Save"}
                </button>
              )}
              {current != null && !dirty && (
                <button type="button" disabled={busy} onClick={clear} className="k-btn k-btn-ghost h-9 px-3 text-[13px]">
                  {busy ? "Switching..." : "Back to one budget per mission"}
                </button>
              )}
            </div>
            {error && <p className="text-[12px] text-[var(--data-rose)]">{error}</p>}
          </>
        )}
      </div>
    </section>
  );
}
