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
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
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

  it("sidebar no longer has the entity-badge reveal machinery (Database removed)", () => {
    // The entity Database section + its count badges were removed — lead data is
    // surfaced via the overview's lead detail panel. The badge-reveal latch went
    // with it; the nav-row skeleton (next test) still gates the static top items.
    // (SidebarLink keeps a generic `badgePending` prop; what's gone is the
    // entity-count wiring that fed the Database badges.)
    expect(sidebar).not.toContain("entityCounts");
    expect(sidebar).not.toContain("badge: entityCounts");
  });

  it("sidebar reveals the whole nav group at once (no static-first / data-later wave)", () => {
    // Whole nav body held behind defsReady with skeleton rows so top items and
    // the Outcomes block appear together, not in two waves.
    expect(sidebar).toContain("SidebarNavRowSkeleton");
    expect(sidebar).toMatch(/!defsReady \? \(/);
  });
});

describe("route-transition loading.tsx boundaries (instant nav skeletons)", () => {
  const authed =
    "../src/app/(authed)/(dashboard)/orgs/[orgId]";
  // The campaign segment (campaigns/[id]) was removed with the campaign concept,
  // so its loading.tsx boundary is gone too — the dashboard now has org + brand
  // levels only.
  const boundaries = [
    `${authed}/loading.tsx`,
    `${authed}/brands/[brandId]/loading.tsx`,
  ];

  it("ships a loading.tsx at every dashboard segment level (org/brand)", () => {
    for (const rel of boundaries) {
      const p = path.join(__dirname, rel);
      expect(fs.existsSync(p), `${rel} must exist`).toBe(true);
      expect(fs.readFileSync(p, "utf-8")).toContain("DashboardPageSkeleton");
    }
  });

  it("the skeleton matches the dense-page container so the transition is shift-free", () => {
    const skel = fs.readFileSync(
      path.join(__dirname, "../src/components/dashboard-page-skeleton.tsx"),
      "utf-8",
    );
    const page = fs.readFileSync(
      path.join(__dirname, "../src/components/dashboard-page.tsx"),
      "utf-8",
    );
    expect(skel).toContain('<DashboardPage width="wide">');
    expect(page).toContain("p-4 md:p-8");
    expect(page).toContain('wide: "max-w-7xl"');
  });
});

describe("feature pages adopt the coordinated body reveal", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, rel), "utf-8");

  it("feature overview reveals revenue + cost cards on their OWN data (per-card barrier)", () => {
    const src = read(
      "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
    );
    expect(src).toContain("useCoordinatedReveal");
    // Revenue (features-service) and Total-spent (runs-service) resolve on different
    // cold chains → SEPARATE latches, so the fast cost card never waits on the slower
    // revenue call (#1551: one barrier per card, never a single AND of both queries).
    expect(src).toMatch(/useCoordinatedReveal\(\[data !== undefined\]\)/);
    expect(src).toMatch(/useCoordinatedReveal\(\[costData !== undefined\]\)/);
    expect(src).not.toMatch(/data !== undefined,\s*costData !== undefined/);
  });

  // The legacy app-level feature page (`features/[featureId]/page.tsx`, the
  // cross-brand "Campaigns" island) was removed in the #1768 follow-up.
});
