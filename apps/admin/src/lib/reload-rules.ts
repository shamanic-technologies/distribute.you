"use client";

import { useEffect, useState } from "react";
import { getReloadRules } from "@/lib/api";

/**
 * billing's reload rules for the open org, in whole dollars (RELOAD-RULE-ONE-HOME-1118).
 * Every reload minimum and default these pages show or check comes from billing; none is
 * held here. null while reading or when billing could not be asked (billing still
 * refuses below its minimums with a 400 the page shows).
 */
export interface ReloadRulesUsd {
  firstTopupMinUsd: number;
  reloadMinUsd: number;
  thresholdMinUsd: number;
  defaultThresholdUsd: number;
}

/** `refreshKey` re-reads the rules when it changes (a modal opening on another org). */
export function useReloadRulesUsd(refreshKey?: unknown): ReloadRulesUsd | null {
  const [rules, setRules] = useState<ReloadRulesUsd | null>(null);
  useEffect(() => {
    let live = true;
    getReloadRules()
      .then((r) => {
        if (!live) return;
        const up = (c: number) => Math.ceil(c / 100);
        setRules({
          firstTopupMinUsd: up(r.first_topup_minimum_cents),
          reloadMinUsd: up(r.reload_amount_minimum_cents),
          thresholdMinUsd: up(r.reload_threshold_minimum_cents),
          defaultThresholdUsd: up(r.default_reload_threshold_cents),
        });
      })
      .catch((err) => console.error("[admin] reload rules read failed:", err));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  return rules;
}

/** A typed threshold in cents, else billing's default threshold for the org. */
export async function thresholdCentsOrDefault(typed: string | null | undefined): Promise<number> {
  if (typed) {
    const n = Math.round(parseFloat(typed) * 100);
    if (Number.isFinite(n)) return n;
  }
  return (await getReloadRules()).default_reload_threshold_cents;
}

/** A threshold carried in a URL (cents), else billing's default threshold for the org. */
export async function thresholdCentsParamOrDefault(raw: string | null | undefined): Promise<number> {
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) return n;
  }
  return (await getReloadRules()).default_reload_threshold_cents;
}
