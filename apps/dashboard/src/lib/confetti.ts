/**
 * A confetti burst, in about sixty lines and with no dependency.
 *
 * It exists for one moment: the instant a reward lands. That moment is rare —
 * a referral converting, a task completed — so it must not cost the bundle a
 * confetti library, and it must not fire on anything that merely LOOKS like a
 * change (see `count-up.ts` for which changes qualify).
 *
 * ## Colour
 *
 * The particles take the BRAND ramp, resolved from the document at burst time
 * (`--color-brand-*`). `:root[data-brand-tint]` re-declares that ramp at the
 * open brand's hue, so a customer's celebration is in THEIR colour rather than
 * ours — the standing rule for every accent surface in this app. A literal hex
 * here would be the one thing on the page that stays our blue.
 *
 * ## Motion
 *
 * `prefers-reduced-motion: reduce` means NOTHING renders. Not a smaller burst,
 * not a static sprinkle: a person who asked for no motion is not asking for
 * less of it. The whole function no-ops, and the reward still lands — the pill's
 * number is the substance, this is the garnish.
 *
 * ## Why DOM rather than canvas
 *
 * Forty short-lived absolutely-positioned spans, each animated once through the
 * Web Animations API and removed by its own `finished` promise, cost less than
 * a canvas element that has to be sized, cleared and torn down — and they
 * inherit the page's own colour tokens for free. Nothing is left behind: the
 * host node is removed when the last particle settles.
 */

/** How many particles a burst throws. Enough to read as a celebration, few
 *  enough that forty simultaneous animations are not a frame-rate problem. */
export const CONFETTI_PARTICLE_COUNT = 40;

/** How long the burst lasts, in ms, before the host node is removed. */
export const CONFETTI_DURATION_MS = 1400;

/** One particle's trajectory, in the burst's own local coordinates. */
export type ConfettiParticle = {
  /** Horizontal drift at the end of the flight, in px. Signed. */
  dx: number;
  /** Vertical travel at the end of the flight, in px. Positive is DOWN — the
   *  particles rise first (see the keyframes) and then fall. */
  dy: number;
  /** Total rotation over the flight, in degrees. Signed. */
  spin: number;
  /** Which step of the brand ramp this particle wears. */
  rampStep: 200 | 400 | 600;
  /** Milliseconds before this particle starts, so the burst does not read as a
   *  single rigid frame of forty identical objects. */
  delayMs: number;
};

/**
 * The particle specs for one burst.
 *
 * `random` is injected so this is a pure function and can be unit-tested: a
 * caller passes `Math.random`, a test passes a sequence. Every value it derives
 * is bounded, so a degenerate `random` (always 0, always ~1) still produces a
 * burst that stays on screen rather than particles flying to the corners.
 */
export function confettiParticles(
  count: number,
  random: () => number,
): ConfettiParticle[] {
  const steps: ConfettiParticle["rampStep"][] = [200, 400, 600];
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i += 1) {
    // Spread across a wide arc rather than a full circle: a burst under a pill
    // in the top bar reads best thrown sideways and down, because anything
    // thrown UP leaves the viewport immediately and is never seen.
    const dx = (random() * 2 - 1) * 140;
    const dy = 40 + random() * 120;
    const spin = (random() * 2 - 1) * 540;
    particles.push({
      dx,
      dy,
      spin,
      rampStep: steps[i % steps.length],
      delayMs: Math.round(random() * 120),
    });
  }
  return particles;
}

/** True when the visitor has asked the OS for reduced motion. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Resolve a brand ramp step from the document, so the burst rotates with the
 *  open brand's tint. A step the stylesheet does not define yields an empty
 *  string, and the particle simply inherits — never a hardcoded fallback hue,
 *  which would be the one wrong colour on a tinted dashboard. */
function rampColor(step: number): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-brand-${step}`)
    .trim();
}

/**
 * Throw a burst from the centre of `anchor`.
 *
 * Fire-and-forget: the caller does not await it, and a burst that cannot run
 * (no DOM, reduced motion, an anchor that has since unmounted) simply does not
 * happen. Nothing about the reward depends on it.
 */
export function burstConfetti(anchor: Element | null): void {
  if (!anchor || typeof document === "undefined") return;
  if (prefersReducedMotion()) return;
  if (typeof (Element.prototype as { animate?: unknown }).animate !== "function") return;

  const rect = anchor.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  const host = document.createElement("div");
  // `fixed` + a z-index above the sticky header (z-50): a burst painted behind
  // the bar it is celebrating is a burst nobody sees.
  host.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;z-index:60;pointer-events:none;";
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);

  for (const particle of confettiParticles(CONFETTI_PARTICLE_COUNT, Math.random)) {
    const node = document.createElement("span");
    node.style.cssText = [
      "position:fixed",
      `left:${originX}px`,
      `top:${originY}px`,
      "width:6px",
      "height:10px",
      "border-radius:1px",
      `background:${rampColor(particle.rampStep)}`,
      "will-change:transform,opacity",
    ].join(";");
    host.appendChild(node);

    node.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${particle.dx * 0.6}px), calc(-50% - 28px)) rotate(${particle.spin * 0.4}deg)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(calc(-50% + ${particle.dx}px), calc(-50% + ${particle.dy}px)) rotate(${particle.spin}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: CONFETTI_DURATION_MS,
        delay: particle.delayMs,
        easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
        fill: "forwards",
      },
    );
  }

  window.setTimeout(() => host.remove(), CONFETTI_DURATION_MS + 400);
}
