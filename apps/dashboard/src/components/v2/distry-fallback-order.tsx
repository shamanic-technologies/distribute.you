"use client";

import { useState } from "react";

/** One model x thinking level of chat-service's served `fallbackOrder` (DISTRY-THINKING-1122). */
export interface DistryFallbackCandidate {
  provider: string;
  model: string;
  modelId: string;
  displayName: string;
  level: string | null;
  score: number | null;
  intelligencePerDollar: number | null;
}

/** A thinking level in words: null = the model's default, `none` = reasoning off, else the served level capitalised. */
export function thinkingWords(level: string | null): string {
  if (level === null) return "Model default";
  if (level === "none") return "Reasoning off";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

const FIRST = 5;

/**
 * Where Distry answers when its model cannot serve a turn: chat-service's sentence, then its order
 * as served (best intelligence per dollar first, unscored last). Nothing ranked here.
 */
export function DistryFallbackOrder({ nextFallback, order }: { nextFallback: string | null; order: DistryFallbackCandidate[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? order : order.slice(0, FIRST);
  return (
    <div className="k-card mb-4 overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <div className="k-label">If Distry&apos;s model cannot serve</div>
        <p className="mt-1 text-[14px]">{nextFallback ?? "No other model can serve Distry right now."}</p>
      </div>
      {order.length > 0 && (
        <ol className="k-line-subtle border-t">
          {shown.map((c, i) => (
            <li key={`${c.provider}-${c.modelId}-${c.level ?? "default"}`} className="k-line-subtle flex items-baseline gap-3 border-b px-4 py-1.5 text-[13px] last:border-b-0">
              <span className="k-mono k-fg3 w-5 shrink-0 text-right text-[12px] tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {c.displayName}
                <span className="k-fg3"> · {thinkingWords(c.level)}</span>
              </span>
              <span className="k-fg3 shrink-0 text-[12px] tabular-nums">
                {c.intelligencePerDollar == null ? "Not scored" : `${c.intelligencePerDollar.toLocaleString("en-US", { maximumSignificantDigits: 3 })} index / $`}
              </span>
            </li>
          ))}
        </ol>
      )}
      {order.length > FIRST && (
        <div className="k-fg3 k-line-subtle border-t px-4 py-2 text-[12px] tabular-nums">
          <button type="button" className="k-btn-ghost" onClick={() => setAll(!all)}>
            {all ? "Show the first 5" : `Show ${order.length - FIRST} more`}
          </button>
        </div>
      )}
    </div>
  );
}
