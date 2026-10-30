import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The motion kit (`public/landing/v2/motion.js`): one module of named effects every page
 * calls with `data-motion="<name>"`. Rendered behaviour (count-up holds its width, reduced
 * motion loads nothing) was verified with Playwright on `/indexes/<slug>`; this pins the
 * contract a page relies on.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const kit = read("public/landing/v2/motion.js");

const EFFECTS = ["reveal", "count-up", "marquee", "sticky-story", "scrub", "orbit", "typewriter", "chat", "bar-grow", "beams", "lead-rows", "mail-flow"];

describe("the motion kit", () => {
  it("names every effect the outcome pages call", () => {
    for (const e of EFFECTS) expect(kit).toMatch(new RegExp(`(\\n    "?${e}"?: function)`));
  });

  it("self-hosts GSAP + ScrollTrigger and loads them only on a page that asks for motion", () => {
    for (const f of ["gsap-3.15.0.min.js", "ScrollTrigger-3.15.0.min.js"]) {
      expect(kit).toContain(f);
      expect(existsSync(path.join(ROOT, "public/landing/v2/vendor", f))).toBe(true);
    }
    expect(kit.indexOf('querySelectorAll("[data-motion]")')).toBeLessThan(kit.indexOf("load(FILES[0])"));
  });

  it("honours reduced motion: nothing loads, and effects run only under no-preference", () => {
    expect(kit).toContain('matchMedia("(prefers-reduced-motion: reduce)").matches) return;');
    expect(kit).toContain('mm.add("(prefers-reduced-motion: no-preference)"');
  });

  it("every rendered page carries the kit, and the demo section calls it", () => {
    expect(read("src/lib/v2-shell.ts")).toContain('<script src="/landing/v2/motion.js?v=${MOTION_VERSION}" defer></script>');
    const ix = read("src/lib/pages/indexes.ts");
    expect(ix).toContain('<div class="ix-value" data-motion="count-up">');
  });
});
