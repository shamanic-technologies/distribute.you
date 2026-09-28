"use client";

/**
 * The motion of `/get-started`. Three rules hold for every piece here:
 *  - it REVEALS a value that is already known (a count the producer returned, the
 *    email it wrote); it never invents one, and it never delays the real value past
 *    its own animation;
 *  - `prefers-reduced-motion` gets the final state at once;
 *  - it runs once per value: a poll or a re-render does not replay it.
 * The keyframes live in `keel.css` under `.gs-*`.
 */

import { useEffect, useRef, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from where it was to `target`, easing out. The last frame is `target` exactly. */
export function useCountUp(target: number, ms = 900): number {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced || !Number.isFinite(target)) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = origin + (target - origin) * easeOut(t);
      setShown(t === 1 ? target : v);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduced]);
  return shown;
}

export function CountUp({ value, format, ms }: { value: number; format: (n: number) => string; ms?: number }) {
  const shown = useCountUp(value, ms);
  return <span className="tabular-nums">{format(shown)}</span>;
}

/**
 * Types `text` out once, then holds it. The whole text is in the accessible name from
 * the first frame (a screen reader is not made to wait on a visual effect).
 */
export function Typewriter({ text, className = "", onDone }: { text: string; className?: string; onDone?: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (reduced) {
      setN(text.length);
      done.current?.();
      return;
    }
    setN(0);
    const ms = Math.min(3200, Math.max(1200, text.length * 6));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setN(Math.round(text.length * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else done.current?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, reduced]);
  const typing = n < text.length;
  return (
    <p className={className} aria-label={text}>
      <span aria-hidden="true" className={typing ? "gs-caret" : ""}>
        {text.slice(0, n)}
      </span>
    </p>
  );
}

/** Seconds since `key` last changed, for a live "working for 0:14" line. */
export function useElapsed(key: string | null): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    if (!key) return;
    const start = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [key]);
  return secs;
}

export function formatElapsed(secs: number): string {
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

/** A cascade delay for the i-th item of a list, capped so a long list does not drag. */
export function stagger(i: number, stepMs = 55, capMs = 700): React.CSSProperties {
  return { animationDelay: `${Math.min(i * stepMs, capMs)}ms` };
}
