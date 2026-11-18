"use client";

import { useEffect, useState } from "react";
import { getReloadRules } from "@/lib/api";

/**
 * billing's reload rules for the open org, in whole dollars (RELOAD-RULE-ONE-HOME-1118).
 * Every reload minimum these pages show or check comes from billing; none is held here.
 * There is no threshold: a reload fires when the balance reaches $0, for everyone
 * (owner 2026-11-18). null while reading or when billing could not be asked (billing
 * still refuses below its minimums with a 400 the page shows).
 */
export interface ReloadRulesUsd {
  firstTopupMinUsd: number;
  reloadMinUsd: number;
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
        setRules({ firstTopupMinUsd: up(r.first_topup_minimum_cents), reloadMinUsd: up(r.reload_amount_minimum_cents) });
      })
      .catch((err) => console.error("[admin] reload rules read failed:", err));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  return rules;
}
