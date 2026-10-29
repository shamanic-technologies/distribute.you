import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ledgerRunsQuery, nextLedgerRunsCursor, BrandLedgerSchema } from "../src/lib/v2/brand-ledger";
import { personName, pipeQueueQuery, teamPipes } from "../src/lib/v2/team-work";

// FACTORY-P4-PAGES: the staff Ledger and Done by your team pages.
const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const BRAND = "app/(authed)/v2/orgs/[orgId]/brands/[brandId]";

describe("Ledger: runs-service's books, drawn not computed", () => {
  it("pages production orders on the producer's keyset cursor", () => {
    expect(ledgerRunsQuery(null)).toBe("limit=50");
    const next = nextLedgerRunsCursor({ brandId: "b", before: "x", windowStart: "w", runs: [], nextBefore: "2026-10-28 10:00:00.123456+00", nextBeforeId: "r1" });
    expect(new URLSearchParams(ledgerRunsQuery(next)).get("before")).toBe("2026-10-28 10:00:00.123456+00");
    expect(new URLSearchParams(ledgerRunsQuery(next)).get("beforeId")).toBe("r1");
  });

  it("parses the served books, the reconciliation verdict included", () => {
    const m = { grossCents: "1.0000000000", netCents: "1.0000000000", vendorCents: "0.5000000000", unpricedGrossCents: "0.0000000000" };
    const books = { production: m, standardCharged: m, reuseGain: m, producedNone: m, support: m, undeclared: m, abnormal: m, spend: m, difference: m, balanced: true };
    const parsed = BrandLedgerSchema.safeParse({ brandId: "b", since: "2026-10-01", until: "2026-10-29", complete: true, daysMissing: [], books, days: [{ day: "2026-10-29", occurrences: 2, ...books }], outcomes: [] });
    expect(parsed.success).toBe(true);
  });

  it("sums no served money in the browser and reads the verdict as served", () => {
    const page = read("components/v2/ledger-page.tsx");
    expect(page).not.toMatch(/\.reduce\(/);
    expect(page).toContain("l.books.balanced");
    expect(page).toContain("l.books.difference.grossCents");
  });
});

describe("Done by your team: the client's own pipes, lead-service's queue", () => {
  const base = { running: true, operatedBy: "customer", fromKey: "meeting_booked", fromLabel: "Meeting booked", toKey: "meeting_attended", toLabel: "Meeting attended" };
  it("keeps running pipes a customer-operated channel works, from a step, once each", () => {
    const pipes = teamPipes([
      { ...base, pipeId: "your-team-meeting-attendance|meeting_booked_to_meeting_attended", pipeName: "Heron" },
      { ...base, pipeId: "your-team-meeting-attendance|meeting_booked_to_meeting_attended", pipeName: "Heron" },
      { ...base, pipeId: "cold-email|start_to_conversation", pipeName: "Dotterel", operatedBy: "platform", fromKey: null },
      { ...base, pipeId: "your-team-closing-calls|meeting_attended_to_paid_client", pipeName: "Kite", running: false },
      { ...base, pipeId: "your-team-x|start", pipeName: "Entry", fromKey: null },
    ]);
    expect(pipes.map((p) => p.pipeName)).toEqual(["Heron"]);
  });

  it("asks lead-service by the pipe's leg, and names a person as served", () => {
    expect(pipeQueueQuery("b", "meeting_booked", "meeting_attended")).toBe("brandId=b&from=meeting_booked&to=meeting_attended");
    expect(personName({ firstName: "Ada", lastName: null, name: "Ada L.", orgName: "Acme" })).toBe("Ada");
    expect(personName({ firstName: null, lastName: null, name: null, orgName: "Acme" })).toBe("Acme");
  });

  it("reuses the lead update control, never a new one", () => {
    const page = read("components/v2/team-work-page.tsx");
    expect(page).toContain('import { LeadStatus } from "@/components/v2/today-roi-panel"');
    expect(page).toContain("<LeadStatus ");
  });
});

describe("both pages are staff only", () => {
  it("wraps each page in StaffOnly and lists them in the staff sidebar only", () => {
    for (const p of ["ledger/page.tsx", "team-work/page.tsx"]) expect(read(`${BRAND}/${p}`)).toContain("<StaffOnly>");
    const shell = read("components/v2/v2-shell.tsx");
    const staff = shell.slice(shell.indexOf("function StaffObjectSections("));
    expect(staff).toContain('v2Href(orgId, brandId, "ledger")');
    expect(staff).toContain('v2Href(orgId, brandId, "team-work")');
    expect(shell.slice(0, shell.indexOf("function StaffObjectSections("))).not.toContain('"ledger"');
  });
});
