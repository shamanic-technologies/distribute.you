"use client";

/**
 * The two urgency strips on the `/get-started` wall, copied from Explee's paywall
 * (owner-decided 2026-09-28: "on garde, on copie pour le moment, on change ensuite").
 * Their logic is lifted from Explee's own bundle (`apps/landing/clones/explee`), so the
 * behaviour matches theirs: a 7:30 countdown stored per browser, then a 9:59 extension,
 * then a line saying the credit stays; and a trial-spots count seeded by the hour.
 *
 * Neither figure is a limit we enforce: the $30 is granted whatever the clock says.
 * Replace or remove both when the owner decides; nothing else reads them.
 */

import { useEffect, useState } from "react";

const TIMER_KEY = "gs_trial_timer_start";
const INITIAL_SECS = 450;
const EXTENDED_END_SECS = 1049;
const EXTENDED_SECS = EXTENDED_END_SECS - INITIAL_SECS;
const SPOTS_TOTAL = 12;

type Phase = { phase: "initial" | "extended" | "expired"; secondsLeft: number };

export function timerPhase(startMs: number, nowMs: number): Phase {
  const t = Math.floor((nowMs - startMs) / 1000);
  if (t < INITIAL_SECS) return { phase: "initial", secondsLeft: INITIAL_SECS - t };
  if (t < EXTENDED_END_SECS) return { phase: "extended", secondsLeft: EXTENDED_END_SECS - t };
  return { phase: "expired", secondsLeft: 0 };
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

/** Explee's hourly figure: a PRNG seeded by the hour, taken down as the hour goes on. */
export function spotsTakenThisHour(nowMs: number): number {
  let seed = Math.floor(nowMs / 3_600_000) >>> 0;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let e = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e;
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  };
  const minute = (nowMs / 60_000) % 60;
  let taken = 0;
  for (let i = 0; i < 9; i++) if (75 * rand() - 20 <= minute) taken++;
  return taken;
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

  if (state.phase === "expired") {
    return (
      <div className="k-inset rounded-lg px-3 py-2.5">
        <span className="k-fg text-[13px] font-medium">Alright, no more countdowns. Your $30 is going nowhere.</span>
      </div>
    );
  }
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
  const [taken, setTaken] = useState<number | null>(null);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    const read = () => setTaken(spotsTakenThisHour(Date.now()));
    read();
    const id = setInterval(read, 20_000);
    const once = setTimeout(() => setBump(1), 20_000);
    return () => {
      clearInterval(id);
      clearTimeout(once);
    };
  }, []);
  const left = taken == null ? null : Math.max(3, SPOTS_TOTAL - taken - bump);
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
