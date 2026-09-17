import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { formatGrantedTotal, totalGrantedCents } from "../src/lib/reward-credits";
import { COUNT_UP_MS, countUpValue, easeOutCubic, shouldAnimate } from "../src/lib/count-up";
import { CONFETTI_PARTICLE_COUNT, confettiParticles } from "../src/lib/confetti";

const SRC = join(__dirname, "..", "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** The three modules under test are alias-free on purpose, so these are REAL
 *  unit tests. Adding an `@/…` import to any of them turns every case below
 *  into a resolution failure — keep them alias-free. */

describe("totalGrantedCents", () => {
  it("sums the whole ledger, whatever the reason", () => {
    expect(
      totalGrantedCents([
        { amountCents: "3000" },
        { amountCents: "50000" },
        { amountCents: "100" },
      ]),
    ).toBe(53100);
  });

  it("reads an empty ledger as a measured zero, not as unmeasurable", () => {
    expect(totalGrantedCents([])).toBe(0);
  });

  it("goes null on an unparseable amount rather than under-reporting", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // The dangerous shape: a real grant beside a rotten one. Skipping the bad
    // row would print $30 for an org that was granted far more, and nothing on
    // screen would say a row had been dropped.
    expect(totalGrantedCents([{ amountCents: "3000" }, { amountCents: "" }])).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("refuses a BLANK amount, which Number() reads as a zero-value grant", () => {
    // `Number("")` and `Number("  ")` are both 0, so a finiteness check alone
    // would count a rotten row as a legitimate $0 gift and silently under-report.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(totalGrantedCents([{ amountCents: "" }])).toBeNull();
    expect(totalGrantedCents([{ amountCents: "   " }])).toBeNull();
    expect(totalGrantedCents([{ amountCents: "not-a-number" }])).toBeNull();
    spy.mockRestore();
  });

  it("still reads a REAL zero-value grant as zero", () => {
    // "0" is a legitimate amount and must not be confused with a blank.
    expect(totalGrantedCents([{ amountCents: "0" }, { amountCents: "100" }])).toBe(100);
  });

  it("is a total of what was EARNED, so it never subtracts", () => {
    // Grants are append-only; there is no negative row to model. Pinning the
    // pure-addition property stops a future "net of usage" reading creeping in,
    // which is the balance the Billing page owns and a different number.
    expect(totalGrantedCents([{ amountCents: "100" }, { amountCents: "200" }])).toBe(300);
  });
});

describe("formatGrantedTotal", () => {
  it("renders whole dollars, thousand-separated", () => {
    expect(formatGrantedTotal(53100)).toBe("$531");
    expect(formatGrantedTotal(123456789)).toBe("$1,234,568");
  });

  it("never prints cents on a glanceable badge", () => {
    expect(formatGrantedTotal(3050)).toBe("$31");
    expect(formatGrantedTotal(100)).toBe("$1");
  });
});

describe("shouldAnimate", () => {
  it("refuses a FIRST paint — a page loading is not an event", () => {
    expect(shouldAnimate(null, 53100)).toBe(false);
  });

  it("fires on an increase", () => {
    expect(shouldAnimate(53000, 53100)).toBe(true);
  });

  it("stays silent when nothing moved", () => {
    expect(shouldAnimate(53100, 53100)).toBe(false);
  });

  it("stays silent on a DECREASE — a correction is not a celebration", () => {
    expect(shouldAnimate(53100, 3000)).toBe(false);
  });
});

describe("countUpValue", () => {
  it("starts at the value the reader was already looking at", () => {
    expect(countUpValue(3000, 3100, 0)).toBe(3000);
  });

  it("lands EXACTLY on the target on the final frame", () => {
    // One cent short is a wrong number on screen, and the last frame is the one
    // the eye stops on.
    expect(countUpValue(3000, 3100, COUNT_UP_MS)).toBe(3100);
    expect(countUpValue(3000, 3100, COUNT_UP_MS + 500)).toBe(3100);
  });

  it("moves fast first and settles — the ease is the point", () => {
    const quarter = countUpValue(0, 1000, COUNT_UP_MS * 0.25);
    const half = countUpValue(0, 1000, COUNT_UP_MS * 0.5);
    // Past halfway by the quarter mark: that is what reads as arriving rather
    // than as a spinner.
    expect(quarter).toBeGreaterThan(500);
    expect(half).toBeGreaterThan(quarter);
    expect(half).toBeLessThan(1000);
  });

  it("returns the target when the duration is degenerate", () => {
    expect(countUpValue(0, 500, 0, 0)).toBe(500);
  });
});

describe("easeOutCubic", () => {
  it("is clamped at both ends, so an overshooting frame cannot pass the target", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("confettiParticles", () => {
  it("throws the requested count", () => {
    expect(confettiParticles(CONFETTI_PARTICLE_COUNT, Math.random)).toHaveLength(
      CONFETTI_PARTICLE_COUNT,
    );
  });

  it("stays on screen for a degenerate random in BOTH directions", () => {
    // A burst is decoration; it must never throw particles far enough to widen
    // the document, whatever the generator does.
    for (const random of [() => 0, () => 0.999999, () => 0.5]) {
      for (const p of confettiParticles(20, random)) {
        expect(Math.abs(p.dx)).toBeLessThanOrEqual(140);
        expect(p.dy).toBeGreaterThan(0);
        expect(p.dy).toBeLessThanOrEqual(160);
        expect(p.delayMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("always throws DOWNWARD on net, because anything thrown up leaves the bar", () => {
    for (const p of confettiParticles(40, Math.random)) expect(p.dy).toBeGreaterThan(0);
  });

  it("spreads across the brand ramp rather than one flat colour", () => {
    const steps = new Set(confettiParticles(12, Math.random).map((p) => p.rampStep));
    expect(steps.size).toBe(3);
  });
});

describe("the pill's call site", () => {
  const pill = read("components/rewards/reward-credits-pill.tsx");
  const header = read("components/header.tsx");

  it("is MOUNTED in the top bar — a pill nothing renders is the feature absent", () => {
    expect(header).toContain("<RewardCreditsPill />");
    expect(header).toContain('from "./rewards/reward-credits-pill"');
  });

  it("reads the key the Billing page already polls, so it costs no request", () => {
    expect(pill).toContain('useAuthQuery<{ grants: CreditGrant[] }>(["creditGrants"]');
  });

  it("wears the brand RAMP, never a literal hex, so it rotates with the tint", () => {
    expect(pill).toContain("border-brand-200");
    expect(pill).toContain("bg-brand-50");
    expect(pill).toContain("text-brand-700");
    expect(pill).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(pill).not.toMatch(/\b(bg|text|border)-\[#/);
  });

  it("every class it wears is remapped for the dark surface, tinted and not", () => {
    // The recurring gap in this repo: a tint ships with its `-50` remapped and
    // its text/border weights forgotten, so it is legible in the light default
    // and near-black on dark. Checked in globals.css rather than assumed.
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    for (const cls of ["bg-brand-50", "bg-brand-100", "border-brand-200", "text-brand-700"]) {
      expect(css).toContain(`html.dark .${cls}`);
      expect(css).toContain(`html.dark[data-brand-tint] .${cls}`);
    }
  });

  it("renders NOTHING when it could not measure, errored, or nothing was earned", () => {
    // A `$0` badge is noise and a dash beside a gift reads as broken.
    expect(pill).toContain("if (isError || shown === null || shown <= 0) return null;");
  });

  it("gates the celebration on the pure rule, never on a local re-derivation", () => {
    expect(pill).toContain("shouldAnimate(previous, total)");
    expect(pill).not.toMatch(/total\s*>\s*previous/);
  });

  it("takes the org from the URL, the per-tab source of truth", () => {
    expect(pill).toContain('pathname.split("/")[2]');
    expect(pill).not.toContain("useOrganization");
  });
});

describe("reduced motion", () => {
  const confetti = read("lib/confetti.ts");

  it("renders NO confetti at all — not a smaller burst", () => {
    expect(confetti).toContain("prefers-reduced-motion: reduce");
    expect(confetti).toContain("if (prefersReducedMotion()) return;");
  });

  it("paints above the sticky header, or the burst is invisible", () => {
    // The bar is `sticky top-0 z-50`; a burst behind it celebrates nothing.
    expect(confetti).toContain("z-index:60");
  });

  it("takes its colour from the brand ramp at burst time", () => {
    expect(confetti).toContain("--color-brand-");
    expect(confetti).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("cleans up after itself", () => {
    expect(confetti).toContain("host.remove()");
  });
});
