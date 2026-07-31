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
 * "Queued today" on the Instantly audit table must equal the number
 * instantly-service's send selector decides on: one first email per
 * never-contacted lead, plus the followup steps projected today/overdue.
 *
 * The bug this pins: `queuedFirstUnsent` counts every REMAINING STEP of a
 * never-started lead, so a 3-step sequence contributed 3 to a figure compared
 * against a daily cap. One prod account rendered 102 against a 45/day limit
 * while the selector saw ~32 of 45 — the table read 227% saturated for a
 * mailbox that was healthy, and 29 accounts looked over cap instead of 12.
 */
describe("Instantly audit — queued today", () => {
  it("serves queuedFirstUnsentSequences on the account-health row", () => {
    expect(api).toContain("queuedFirstUnsentSequences: number;");
    expect(api).toContain("queuedFirstUnsentSequences: z.number(),");
  });

  it("derives the due-today figure from sequences, not steps", () => {
    expect(page).toContain(
      "return r.queuedFirstUnsentSequences + r.queuedNextToday;",
    );
  });

  it("never sums the step count into a due-today figure", () => {
    expect(page).not.toContain("queuedFirstUnsent + r.queuedNextToday");
    expect(page).not.toContain("a.queuedFirstUnsent + a.queuedNextToday");
    expect(page).not.toContain(
      "row.queuedFirstUnsent + row.queuedNextToday",
    );
  });

  it("routes the column, its sort, its color and its bins through one helper", () => {
    // Sort, histogram bin, and the table cell all read queuedTodayFor(...), so
    // the table cannot display one number and order by another.
    expect(page).toContain("const av = queuedTodayFor(a);");
    expect(page).toContain("const queuedToday = queuedTodayFor(r);");
    expect(page).toContain("{num(queuedTodayFor(row))}");
    // Exactly one definition of the value.
    const defs = page.match(/function queuedTodayFor\(/g) ?? [];
    expect(defs).toHaveLength(1);
  });

  it("keeps the step total, labelled as steps and apart from due-today", () => {
    expect(page).toContain('<Group title="Due today">');
    expect(page).toContain('<Group title="Queue (all remaining steps)">');
    expect(page).toContain(
      '<Row label="— First-unsent steps">{num(row.queuedFirstUnsent)}</Row>',
    );
  });
});
