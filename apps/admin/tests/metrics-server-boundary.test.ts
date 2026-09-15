import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

const METRICS_PAGE = "../src/app/(authed)/(dashboard)/metrics/page.tsx";
const page = read(METRICS_PAGE);

/**
 * A FUNCTION cannot cross the server/client boundary.
 *
 * `metrics/page.tsx` is a server component (it awaits Clerk `auth()` and is
 * `force-dynamic`). `PeriodCompoundCard` is `"use client"` and takes
 * `formatValue` / `formatAxis` as functions. So a server-rendered view that
 * passes one throws "Functions cannot be passed directly to Client Components"
 * and the whole tab renders an error digest — no stack on screen, the cause only
 * in the container log.
 *
 * That shipped on 2026-09-12 and took the Signups and Paid-users tabs down until
 * both views moved into their own `"use client"` files, beside the three siblings
 * (Overview, Revenue, Active users) that had always been client components.
 *
 * These guards pin the CLASS rather than the two call sites that caused it: any
 * function prop added to the server page is the same bug again, whatever it is
 * called and whichever card it is handed to.
 */
describe("the /metrics server page passes nothing a client component cannot receive", () => {
  it("is a server component", () => {
    expect(page).toContain("@clerk/nextjs/server");
    expect(page.trimStart().startsWith('"use client"')).toBe(false);
  });

  it("hands no FUNCTION to a client component", () => {
    // A function prop written inline reads as ordinary React and is fatal here.
    expect(page).not.toMatch(/formatValue=\{/);
    expect(page).not.toMatch(/formatAxis=\{/);
    // An arrow passed straight into JSX is the same mistake wearing a lambda.
    expect(page).not.toMatch(/=\{\([^)]*\)\s*=>/);
  });

  it("mounts the two rate views rather than rendering them inline", () => {
    expect(page).toContain('from "@/components/signup-view"');
    expect(page).toContain('from "@/components/cards-view"');
    expect(page).toContain("<SignupView");
    expect(page).toContain("<CardsView");
    // The bodies moved out whole — a copy left behind is a second surface to drift.
    expect(page).not.toContain("function SignupView(");
    expect(page).not.toContain("function CardsView(");
  });

  it("keeps the Unique-visitors view server-rendered, charts included", () => {
    // It passes no function, so it has no reason to move — and it is what keeps
    // the page a caller of the shared card, which two sibling guards assert.
    expect(page).toContain("function LandingView(");
    expect(page.split("<PeriodCompoundCard").length - 1).toBeGreaterThan(0);
  });

  it("declares every view that DOES pass a function as a client component", () => {
    for (const rel of [
      "../src/components/signup-view.tsx",
      "../src/components/cards-view.tsx",
      "../src/components/overview-view.tsx",
      "../src/components/revenue-view.tsx",
    ]) {
      const src = read(rel);
      expect(src.trimStart().startsWith('"use client"'), rel).toBe(true);
    }
  });

  it("leaves the shared figure tile usable from both sides", () => {
    // No directive on purpose: the server page renders it for the Unique-visitors
    // view while the two client views render it too. A `"use client"` here would
    // drag the server page into the client bundle to gain nothing.
    const card = read("../src/components/stat-card.tsx");
    expect(card.trimStart().startsWith('"use client"')).toBe(false);
    expect(card).toContain("export function StatCard(");
    expect(page).toContain('from "@/components/stat-card"');
  });

  it("states a rate one way, from one module", () => {
    // Two tabs state the same two kinds of percentage. A second copy is how one
    // page comes to round a rate differently from the tab beside it.
    const fmt = read("../src/lib/funnel-rate-format.ts");
    expect(fmt).toContain("export function pct(");
    expect(fmt).toContain("export function formatRatePct(");
    for (const rel of ["../src/components/signup-view.tsx", "../src/components/cards-view.tsx"]) {
      expect(read(rel), rel).toContain('from "@/lib/funnel-rate-format"');
      expect(read(rel), rel).not.toContain("function formatRatePct(");
    }
  });
});
