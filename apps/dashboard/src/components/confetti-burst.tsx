"use client";

import { useEffect } from "react";

// One-shot confetti burst on mount (post-payment celebration). Dynamic-imports
// canvas-confetti so it stays out of the initial onboarding bundle, and guards
// against SSR (window absent). Renders nothing.
export function ConfettiBurst() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const confetti = (await import("canvas-confetti")).default;
        if (cancelled) return;
        const fire = (particleRatio: number, opts: Record<string, unknown>) =>
          confetti({
            origin: { y: 0.6 },
            particleCount: Math.floor(200 * particleRatio),
            ...opts,
          });
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
      } catch (err) {
        // Confetti is pure delight — never block the (already paid) flow on it.
        console.error("[dashboard] confetti failed to load", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
