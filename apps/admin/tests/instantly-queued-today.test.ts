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

/**
 * `queuedOverdue` (instantly-service v0.73.0) is the BACKLOG subset of
 * `queuedNextToday` — steps whose nominal due date is strictly before today.
 * It answers what the merged today-or-overdue bucket cannot: 50 followups all
 * due today is a busy account, 50 we owed last week is a stuck one.
 *
 * Two properties the producer documents and this page must respect: it is a
 * SUBSET counter (`queuedOverdue <= queuedNextToday`), and it is NOT part of the
 * four-bucket partition of `queueSize` — folding it into that sum double-counts
 * steps already inside `queuedNextToday` and breaks the ✅/❌ debug marker.
 */
describe("Instantly audit — overdue backlog", () => {
  it("reads the producer's field, on the row type and the schema", () => {
    expect(api).toContain("queuedOverdue?: number;");
    expect(api).toContain("queuedOverdue: z.number().optional(),");
  });

  it("gives the backlog its own sortable column", () => {
    expect(page).toContain(
      '{ key: "queuedOverdue", label: "Overdue", numeric: true, align: "right" },',
    );
    // And a header tooltip that states the subset relationship, so nobody adds
    // it to Queued today while reading the table.
    expect(page).toContain(
      "A subset of Queued today, never added to it.",
    );
  });

  it("renders the served value, with a dash when the producer omits it", () => {
    expect(page).toContain("{num(r.queuedOverdue)}");
    expect(page).toContain("r.queuedOverdue === undefined ? (");
    expect(page).toContain(
      '<Row label="— of which overdue (owed before today)">',
    );
  });

  it("never derives the backlog from other fields", () => {
    // The only honest source is the producer. No client-side subtraction of the
    // date buckets, no ratio of the daily limit.
    expect(page).not.toMatch(/queuedNextToday\s*-\s*/);
    expect(page).not.toMatch(/const\s+overdue\s*=/);
  });

  it("keeps the backlog out of the four-bucket partition assertion", () => {
    // The debug column still reconciles queueSize against exactly the four
    // buckets; queuedOverdue re-counts steps already in queuedNextToday.
    expect(page).toContain("const ok = r.queueSize === visibleSum;");
    expect(page).toContain("r.queuedFirstUnsent +");
    expect(page).toContain("r.queuedNextTomorrow +");
    expect(page).toContain("r.queuedNextLater;");
    expect(page).not.toContain("r.queuedOverdue +");
    expect(page).not.toContain("+ r.queuedOverdue");
  });

  it("keeps the due-today figure unchanged", () => {
    // queuedTodayFor stays Initial + Followups. Overdue is a read on the same
    // Followups half, never an addition to the day's due volume.
    const defs = page.match(/function queuedTodayFor\(/g) ?? [];
    expect(defs).toHaveLength(1);
    expect(page).toContain(
      "return r.queuedFirstUnsentSequences + r.queuedNextToday;",
    );
  });
});
