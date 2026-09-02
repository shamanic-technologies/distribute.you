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
 * Send selection fills the in-production pool in a strict ORDER and saturates
 * the head before touching the next mailbox. The accounts table could not show
 * that: sorted by what dispatched most yesterday, the top rows are the ones
 * carrying old followups, so the waterfall reads as broken when the head is
 * simply full. Two producer-owned fields make it legible, and both are additive
 * — the page must render identically against a producer that has not shipped
 * them yet.
 */
describe("Instantly audit — fill order", () => {
  it("reads both fields as optional AND nullable, so an older body still parses", () => {
    expect(api).toContain("fillRank?: number | null;");
    expect(api).toContain("effectiveDailyCap?: number | null;");
    expect(api).toContain("fillRank: z.number().nullable().optional(),");
    expect(api).toContain("effectiveDailyCap: z.number().nullable().optional(),");
  });

  it("puts the rank first, as its own sortable column", () => {
    const columns = page.slice(
      page.indexOf("const COLUMNS = ["),
      page.indexOf("] as const;"),
    );
    expect(columns).toContain('{ key: "fillRank", label: "#", numeric: true, align: "right" }');
    // First entry of the array — the fill order is what the table is read in.
    expect(columns.indexOf("fillRank")).toBeLessThan(columns.indexOf('"email"'));
  });

  it("opens sorted by the rank ascending", () => {
    expect(page).toContain('useState<SortKey>("fillRank")');
    expect(page).toContain('useState<"asc" | "desc">("asc")');
  });

  it("keeps unranked rows last in both directions", () => {
    // The generic comparator branch sorts nulls last regardless of `dir`, and
    // `fillRank` deliberately falls through to it rather than carrying a branch
    // that could disagree with it.
    const cmp = page.slice(page.indexOf("function compareRows("));
    expect(cmp).toContain("if (aNull) return 1; // nulls always last");
    expect(cmp).toContain("if (bNull) return -1;");
  });

  it("renders a dash for a missing rank, never a fabricated one", () => {
    expect(page).toContain("r.fillRank === null || r.fillRank === undefined");
    expect(page).toContain("row.fillRank === null || row.fillRank === undefined");
  });

  it("states the effective cap ONLY when it differs from the configured limit", () => {
    const occurrences = page.split("r.effectiveDailyCap !== r.dailyLimit").length - 1;
    expect(occurrences).toBe(1);
    expect(page).toContain("row.effectiveDailyCap !== row.dailyLimit");
    // Never derived here — the age ramp lives in instantly-service.
    expect(page).not.toContain("effectiveDailyCap =");
  });
});
