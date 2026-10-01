"use client";

/**
 * The two urgency strips on the `/get-started` wall, hardcoded like Explee's paywall
 * (owner-decided 2026-09-28, then 2026-10-01: always a countdown, always 3 spots).
 * A 7:30 countdown stored per browser, then a 9:59 extension, then it starts over: it
 * never stops counting. The spots read 3, always.
 *
 * Neither figure is a limit we enforce: the $30 is granted whatever the clock says.
 * Owner-decided, do not remove them on a no-fake-urgency instinct.
 */

import { useEffect, useState } from "react";

const TIMER_KEY = "gs_trial_timer_start";
const INITIAL_SECS = 450;
const EXTENDED_END_SECS = 1049;
const EXTENDED_SECS = EXTENDED_END_SECS - INITIAL_SECS;
const SPOTS_TOTAL = 12;
/** Hardcoded, like Explee (owner 2026-10-01). */
const SPOTS_LEFT = 3;

type Phase = { phase: "initial" | "extended"; secondsLeft: number };

/** The countdown never ends: past the extension it starts over. */
export function timerPhase(startMs: number, nowMs: number): Phase {
  const t = Math.max(0, Math.floor((nowMs - startMs) / 1000)) % EXTENDED_END_SECS;
  if (t < INITIAL_SECS) return { phase: "initial", secondsLeft: INITIAL_SECS - t };
  return { phase: "extended", secondsLeft: EXTENDED_END_SECS - t };
}

function timerStart(): number {
  try {
    const held = Number.parseInt(localStorage.getItem(TIMER_KEY) ?? "", 10);
    if (Number.isFinite(held)) return held;
    const now = Date.now();
    localStorage.setItem(TIMER_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}


export function TrialTimer() {
  const [start] = useState(timerStart);
  const [state, setState] = useState<Phase>(() => timerPhase(start, Date.now()));
  useEffect(() => {
    const tick = () => setState(timerPhase(start, Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);

  const low = state.secondsLeft <= 60;
  const pct = Math.max(0, Math.min(100, (state.secondsLeft / (state.phase === "extended" ? EXTENDED_SECS : INITIAL_SECS)) * 100));
  const colour = low ? "var(--data-amber)" : "var(--accent)";
  const m = Math.floor(state.secondsLeft / 60);
  return (
    <div className="k-inset grid gap-2 rounded-lg px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="k-fg text-[13px] font-medium">
          {state.phase === "extended" ? "We're giving you more time to lock in your $30" : "Time left to claim your $30 free trial"}
        </span>
        <span className="shrink-0 text-[18px] font-semibold tabular-nums" style={{ color: colour }}>{`${m}:${String(state.secondsLeft % 60).padStart(2, "0")}`}</span>
      </div>
      <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--data-track)]" aria-hidden="true">
        <span className="gs-tick block h-full rounded-full" style={{ width: `${pct}%`, background: colour }} />
      </span>
    </div>
  );
}

export function TrialSpots() {
  const left: number | null = SPOTS_LEFT;
  return (
    <div className="k-inset min-h-[60px] rounded-lg px-3 py-2.5">
      {left != null && (
        <>
          <div className="k-fg flex items-center gap-2 text-[13px] font-medium">
            <span className="k-dot-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--data-amber)] text-[var(--data-amber)]" aria-hidden="true" />
            <span>
              Only{" "}
              <span key={left} className="gs-pop inline-block tabular-nums text-[var(--data-amber)]">
                {left}
              </span>{" "}
              trial spots left this hour
            </span>
          </div>
          <div className="mt-2.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: SPOTS_TOTAL }, (_, i) => (
              <span
                key={i}
                className="gs-fade h-1.5 flex-1 rounded-full"
                style={{ background: i < left ? "var(--data-amber)" : "var(--data-track)" }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
