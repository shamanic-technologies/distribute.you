import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = join(
  __dirname,
  "../src/app/(authed)/(dashboard)/audit/instantly/page.tsx",
);
const API = join(__dirname, "../src/lib/api.ts");

const page = readFileSync(PAGE, "utf8");
const api = readFileSync(API, "utf8");

/**
 * "Daily max send" states the ramp-aware cap the producer computes, on EVERY row.
 *
 * The value shipped for weeks and was invisible: the cell only rendered
 * `effectiveDailyCap` when it differed from `dailyLimit`, and prod serves them
 * equal on 244 of 244 accounts (lifecycle-limits-sync writes the ramped value
 * back into Instantly's own `daily_limit`, so `min(daily_limit, ramp)` is
 * `daily_limit` by construction). A figure gated on a condition that is never
 * true is the feature entirely absent with the component perfectly correct.
 */
describe("Instantly audit — daily max send", () => {
  it("reads the ramp-aware cap through ONE definition", () => {
    const defs = page.match(/function dailyMaxFor\(/g) ?? [];
    expect(defs).toHaveLength(1);
    expect(page).toContain("return r.effectiveDailyCap ?? r.dailyLimit;");
  });

  it("renders the cap on every row, never gated on it differing", () => {
    // The main number is the cap. The pre-ramp configured limit is what the
    // difference gate now guards, so a mature account states one number once
    // and a ramping one states both.
    expect(page).toContain("const dailyMax = dailyMaxFor(r);");
    expect(page).toContain("{dailyMax === null ? \"—\" : num(dailyMax)}");
    expect(page).toContain("ramping up from {num(r.dailyLimit as number)}");
  });

  it("colours Queued today against the same ceiling it renders", () => {
    // A young account compared against its pre-ramp limit reads green against a
    // cap the selector is not letting it reach.
    expect(page).toContain("dailyMax !== null && queuedToday > dailyMax");
    expect(page).not.toMatch(/queuedToday\s*>\s*r\.dailyLimit/);
  });

  it("sorts the column on the value it displays", () => {
    const at = page.indexOf('if (key === "dailyLimit") {');
    expect(at).toBeGreaterThan(-1);
    const body = page.slice(at, page.indexOf("// DEBUG", at));
    expect(body).toContain("dailyMaxFor(a)");
    expect(body).toContain("dailyMaxFor(b)");
  });

  it("states the cap in the row detail panel too", () => {
    expect(page).toContain(
      '<Row label="Daily max send">{num(dailyMaxFor(row))}</Row>',
    );
  });

  it("keeps the field additive on the wire", () => {
    // A producer that has not deployed it yet must fall back to the configured
    // limit rather than blanking the column.
    expect(api).toContain("effectiveDailyCap: z.number().nullable().optional()");
  });
});
