import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { nextRevealState } from "../src/lib/use-coordinated-reveal";

describe("nextRevealState — barrier", () => {
  it("reveals only once every flag is true (from not-yet-revealed)", () => {
    expect(nextRevealState(false, [true, true, true])).toBe(true);
  });

  it("stays hidden while any flag is false (from not-yet-revealed)", () => {
    expect(nextRevealState(false, [true, false, true])).toBe(false);
    expect(nextRevealState(false, [false, false, false])).toBe(false);
  });

  it("an empty group reveals immediately (nothing to wait on)", () => {
    expect(nextRevealState(false, [])).toBe(true);
  });
});

describe("nextRevealState — monotonic latch", () => {
  it("once revealed, stays revealed even if a flag flips back to false", () => {
    // Simulates a background refetch / Clerk token rotation flipping isPending
    // back to true (readiness flag false) AFTER the group has shown.
    expect(nextRevealState(true, [true, false, true])).toBe(true);
    expect(nextRevealState(true, [false, false, false])).toBe(true);
    expect(nextRevealState(true, [])).toBe(true);
  });

  it("models a full lifecycle: hidden → barrier → latched", () => {
    let revealed = false;
    revealed = nextRevealState(revealed, [false, true]); // first paint, partial
    expect(revealed).toBe(false);
    revealed = nextRevealState(revealed, [true, true]); // all resolved → reveal
    expect(revealed).toBe(true);
    revealed = nextRevealState(revealed, [false, true]); // poll/rotation hiccup
    expect(revealed).toBe(true); // never reverts
  });
});

describe("use-coordinated-reveal wiring", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/lib/use-coordinated-reveal.ts"),
    "utf-8",
  );

  it("hook latches via useRef + the pure step", () => {
    expect(src).toContain('import { useRef } from "react"');
    expect(src).toContain("export function useCoordinatedReveal");
    expect(src).toContain("nextRevealState(revealed.current");
  });
});

describe("consumers adopt the coordinated reveal", () => {
  const featurePage = fs.readFileSync(
    path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
    ),
    "utf-8",
  );
  const sidebar = fs.readFileSync(
    path.join(__dirname, "../src/components/context-sidebar.tsx"),
    "utf-8",
  );

  it("feature page body gates on the latched reveal, not a raw allReady flag", () => {
    expect(featurePage).toContain("useCoordinatedReveal");
    // The pre-existing un-latched `const allReady = ... && ...` gate is gone.
    expect(featurePage).not.toMatch(/const allReady\s*=/);
  });

  it("sidebar reveals all entity badges together, latched, with a skeleton pill", () => {
    expect(sidebar).toContain("useCoordinatedReveal");
    expect(sidebar).toContain("badgePending");
    // Badge value still flows from the page's own data source (brand-tools guard).
    expect(sidebar).toContain("badge: entityCounts[e.name]");
  });
});
