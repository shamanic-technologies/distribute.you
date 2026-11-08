import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ledgerRunsQuery, nextLedgerRunsCursor, runResult, BrandLedgerSchema } from "../src/lib/v2/brand-ledger";
import { personName, pipeQueueQuery, teamOutcomes } from "../src/lib/v2/team-work";

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

  it("names what a run made from served facts: outputs, open, support, a free step of its caller, else none", () => {
    const base = { produced: [], status: "completed", supportKind: null, costRows: 0, parent: null };
    expect(runResult({ ...base, produced: [{ outcomeKey: "email_found", occurrences: 1 }], status: "running" })).toEqual({ kind: "made" });
    expect(runResult({ ...base, status: "running" })).toEqual({ kind: "running" });
    expect(runResult({ ...base, supportKind: "product_feature" })).toEqual({ kind: "support", fn: "product feature" });
    expect(runResult({ ...base, parent: { serviceName: "crm-service", taskName: "people.build" } })).toEqual({ kind: "step", parent: "crm-service · people.build" });
    expect(runResult({ ...base, costRows: 2, parent: { serviceName: "crm-service", taskName: "people.build" } })).toEqual({ kind: "none" });
    expect(runResult(base)).toEqual({ kind: "none" });
    expect(new URLSearchParams(ledgerRunsQuery(null, 50, "made")).get("kind")).toBe("made");
    expect(new URLSearchParams(ledgerRunsQuery(null, 50, "all")).get("kind")).toBeNull();
  });

  it("first paint is shimmer: an error shows only once the query has answered, and the books never poll every 5 s", () => {
    const page = read("components/v2/ledger-page.tsx");
    expect(page).toContain("q.data === undefined && q.isFetchedAfterMount && q.isError");
    expect(page).not.toContain("q.isError && !l");
    const ledgerQuery = page.slice(page.indexOf('useAuthQuery(["brandLedger"'), page.indexOf("const failed"));
    expect(ledgerQuery).not.toContain("pollOptions");
  });

  it("sums no served money in the browser and reads the verdict as served", () => {
    const page = read("components/v2/ledger-page.tsx");
    expect(page).not.toMatch(/\.reduce\(/);
    expect(page).toContain("l.books.balanced");
    expect(page).toContain("l.books.difference.grossCents");
  });
});

describe("Done by your team: the outcomes the client's own team makes, lead-service's queue (owner 2026-11-02: no pipe)", () => {
  const base = { running: true, operatedBy: "customer", fromKey: "meeting_booked", fromLabel: "Meeting booked", toKey: "meeting_attended", toLabel: "Meeting attended" };
  it("keeps running parts a customer-operated channel works, from an outcome, once per outcome pair", () => {
    const outcomes = teamOutcomes([
      { ...base },
      { ...base },
      { ...base, operatedBy: "platform", fromKey: "lead_found", toKey: "conversation" },
      { ...base, fromKey: "meeting_attended", toKey: "paid_client", running: false },
      { ...base, fromKey: null, toKey: "lead_found" },
    ]);
    expect(outcomes).toEqual([{ fromKey: "meeting_booked", fromLabel: "Meeting booked", toKey: "meeting_attended", toLabel: "Meeting attended" }]);
  });

  it("names no pipe on the page", () => {
    const page = read("components/v2/team-work-page.tsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(page).not.toContain("ServedPipeMark");
    expect(page).not.toMatch(/>[^<{]*\bpipes?\b/i);
    expect(page).not.toMatch(/"[^"]*\bpipes?\b[^"]*"/i);
  });

  it("asks lead-service by from and to outcome, and names a person as served", () => {
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

describe("Ledger and Done by your team are client pages (FACTORY-USER-DASHBOARD-1102)", () => {
  it("no StaffOnly on the pages; both in the sidebar's Production group (staff mode only, owner 2026-11-08); the Ledger reads the org-scoped route", () => {
    for (const p of ["ledger/page.tsx", "team-work/page.tsx"]) expect(read(`${BRAND}/${p}`)).not.toContain("StaffOnly");
    const shell = read("components/v2/v2-shell.tsx");
    const client = shell.slice(0, shell.indexOf("function StaffObjectSections("));
    const production = client.slice(client.indexOf('<Group title="Production" staff>'), client.indexOf('<Group title="Setup">'));
    for (const r of ['"ledger"', '"team-work"', 'label="Connected accounts"']) expect(production).toContain(r);
    const api = read("lib/api.ts");
    expect(api).toContain("apiCall<unknown>(`/brands/${encodeURIComponent(brandId)}/ledger`)");
    expect(api).not.toContain("`/runs/brands/${encodeURIComponent(brandId)}/ledger");
  });
});
