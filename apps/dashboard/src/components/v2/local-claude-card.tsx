"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ProviderLogo } from "@/components/provider-logo";
import { getLocalLlm, setLocalLlm, type LocalLlmState } from "@/lib/api";
import { formatUsdAdaptive } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { Shimmer } from "@/components/v2/ui";

/** Where a customer gets the Mac app that runs the calls (the landing's own page). */
export const MAC_APP_URL = "https://distribute.you/desktop";

/**
 * AI on my Claude Code (LOCAL-CLAUDE-1116, owner 2026-11-16: « le user dépense $0, car tout
 * depuis sa subscription Claude Code »). The org declares it once (`PUT /v1/local-llm`); the
 * Mac app then answers every call it can on the user's own Claude Code. Every figure is
 * chat-service's, served through the gateway: the runner state, the calls answered, what we
 * charged (always $0) and the kinds of calls that still run on our side with their reason.
 *
 * A runner not connected while declared is the normal "open the Mac app" state, said in
 * plain colours; it turns rose only while calls are WAITING for it.
 */
export function LocalClaudeCard() {
  const queryClient = useQueryClient();
  const queryKey = ["localLlm"];
  const stateQ = useAuthQuery<LocalLlmState>(queryKey, () => getLocalLlm(), pollOptions);
  // The pressed position shows at once; the served answer wins once it lands.
  const [pressed, setPressed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setLocalLlm(enabled),
    onMutate: (enabled) => {
      setError(null);
      setPressed(enabled);
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey, next);
      setPressed(null);
    },
    onError: (err: Error) => {
      setPressed(null);
      console.error("[local-claude] switching failed", err);
      setError("We could not change this right now. Try again in a moment.");
    },
  });

  const state = stateQ.data;
  const on = pressed ?? state?.declared ?? false;

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="k-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]">
          <ProviderLogo domain="claude.ai" size={20} className="rounded-[4px]" />
        </span>
        <div className="min-w-[200px] flex-1">
          <span className="text-[14px] font-medium leading-5">Claude Code</span>
          <p className="k-fg2 mt-0.5 text-[13px] leading-5">Your Mac app answers our AI&apos;s calls with your own Claude Code.</p>
        </div>
        {state ? (
          <label className="flex shrink-0 items-center gap-2 text-[13px]">
            <span className={on ? "" : "k-fg2"}>{on ? "On" : "Off"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label="Run our AI on my Claude Code"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(!on)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--run)]" : "bg-[var(--data-track)]"}`}
            >
              <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
            </button>
          </label>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-[13px] text-[var(--data-rose)]">{error}</p> : null}

      <div className="mt-3">
        {state === undefined ? (
          stateQ.isError ? (
            <p className="k-fg2 text-[13px]">We could not read this setting just now.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Shimmer className="h-10 w-full" />
              <Shimmer className="h-16 w-full" />
            </div>
          )
        ) : (
          <LocalClaudeBody state={state} on={on} />
        )}
      </div>
    </div>
  );
}

/** The served state, read only. Exported for the render probe. */
export function LocalClaudeBody({ state, on }: { state: LocalLlmState; on: boolean }) {
  const usage = state.usageLast30Days;
  return (
    <div className="space-y-3">
      {on ? <RunnerLine state={state} /> : (
        <p className="k-fg2 text-[13px]">
          Turn it on, then open the{" "}
          <a href={MAC_APP_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
            Mac app
          </a>
          . Our AI then answers on your Mac, on your own plan.
        </p>
      )}

      <div className="k-inset grid grid-cols-1 divide-y divide-[var(--line-subtle)] rounded-[8px] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Cell label="Calls answered" note="30 days" value={usage.calls.toLocaleString("en-US")} />
        <Cell
          label="Charged by us"
          note="30 days"
          // A whole zero reads "$0", the way the owner says it; any other served amount keeps its cents.
          value={usage.chargedUsd === 0 ? "$0" : formatUsdAdaptive(usage.chargedUsd)}
          sub={usage.notionalCostUsd > 0 ? `${formatUsdAdaptive(usage.notionalCostUsd)} at API prices` : null}
        />
        <Cell label="Calls waiting" note="now" value={state.pendingCalls.toLocaleString("en-US")} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="k-label">Runs on your Mac</p>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-[18px]">
            {state.runsLocally.map((family) => (
              <li key={family} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--run)]" />
                <span className="k-fg2">{family}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="k-label">Still on our side</p>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-[18px]">
            {state.stillOnPlatform.map((f) => (
              <li key={f.family} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fg-4)]" />
                <span>
                  <span className="k-fg2">{f.family}</span>
                  <span className="k-fg3">: {f.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * The Mac app's state. Connected = green. Not connected is the normal "open the Mac app" state
 * in plain colours, rose only while calls wait for it (they fall back to our side if it stays shut).
 */
function RunnerLine({ state }: { state: LocalLlmState }) {
  const { runner, pendingCalls } = state;
  if (runner.connected) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
        <span>Mac app connected</span>
        {runner.name ? (
          <span className="k-fg3 text-[12px]">
            {runner.name}
            {runner.version ? ` ${runner.version}` : ""}
          </span>
        ) : null}
      </p>
    );
  }
  const waiting = pendingCalls > 0;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[13px]">
      <span className={`h-2 w-2 rounded-full border-[1.5px] ${waiting ? "border-[var(--data-rose)]" : "border-[var(--fg-2)]"}`} />
      <span className={waiting ? "text-[var(--data-rose)]" : ""}>
        {waiting
          ? `${pendingCalls.toLocaleString("en-US")} ${pendingCalls === 1 ? "call waits" : "calls wait"} for your Mac app`
          : "Open the Mac app to answer the next calls"}
      </span>
      {runner.lastSeenAt ? <span className="k-fg3 text-[12px]">Last seen {timeAgo(runner.lastSeenAt).toLowerCase()}</span> : null}
      <a href={MAC_APP_URL} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[var(--accent)] hover:underline">
        Get the Mac app
      </a>
    </p>
  );
}

function Cell({ label, note, value, sub }: { label: string; note: string; value: string; sub?: string | null }) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">{label}</span>
        <span className="k-fg3 text-[11px]">{note}</span>
      </div>
      <p className="mt-1 text-[22px] font-medium leading-7 tabular-nums">{value}</p>
      {sub ? <p className="k-fg3 text-[12px] tabular-nums">{sub}</p> : null}
    </div>
  );
}
