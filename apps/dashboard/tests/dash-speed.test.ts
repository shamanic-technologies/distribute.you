import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  isPersistableQueryKey,
  PERSISTABLE_QUERY_ROOTS,
  SENSITIVE_QUERY_ROOTS,
  STAFF_FLAG_ROOTS,
} from "../src/lib/persist-cache";

/**
 * DASH-SPEED-1110 (owner 2026-11-08, again 2026-11-09: « make every page instant, why do I have to ask again
 * every day? »). A prod audit of every v2 page found pages that waited 10-30 s on EVERY visit because a read
 * they paint from was never written to the browser's saved copy, and a money read that waited on the campaigns
 * read before it even started. These guards hold the whole v2 tree, not one page, so a new page cannot
 * ship slow the same way.
 */

const DASH = path.join(__dirname, "..");
const V2_DIRS = [path.join(DASH, "src/components/v2"), path.join(DASH, "src/app/(authed)/v2")];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}
const v2Files = V2_DIRS.flatMap(walk);

/** A staff-only surface: Monitoring (and its price refresh), Research, staff catalogue/campaign pages, workflows. */
const isStaffSurface = (file: string) => /\/(monitoring|research|staff|workflow|price-refresh)[^/]*\.tsx?$/.test(file);

/**
 * Sensitive roots a NON-staff v2 file reads, each with why it never goes to disk. Anything else a customer
 * page reads must persist. Adding a line here is a decision to make that surface wait on every visit.
 */
const NEVER_ON_DISK_ON_CUSTOMER_FILES: Record<string, string> = {
  apiKeys: "key material",
  personApiCall: "a whole API call body",
  personTimeline: "private message bodies from the brand's inboxes",
  brandLedger: "staff cost data (our margin)",
  brandLedgerRuns: "staff cost data (our margin)",
  staffBrandLinkedinPosts: "staff Posting surface, read live",
  staffMyLinkedinPosts: "staff Profile surface, read live",
  factoryShadowPlan: "staff GTM Factory plan",
  staffPipeStats: "staff pipe figures",
};

describe("every root a customer v2 page reads paints from the saved copy", () => {
  it("customer reads of the staff-flagged roots persist; the staff route's vendor cost never does", () => {
    expect(isPersistableQueryKey(["staffAudienceSnapshot", "b", false])).toBe(true);
    expect(isPersistableQueryKey(["staffAudienceSnapshot", "b", true])).toBe(true);
    expect(isPersistableQueryKey(["staffHeldPeople", "b", false, 0, false])).toBe(true);
    expect(isPersistableQueryKey(["staffHeldCompanies", "b", true, 0, false])).toBe(true);
    expect(isPersistableQueryKey(["staffSourcingPeople", "b", false, ["p1"]])).toBe(true);
    expect(isPersistableQueryKey(["staffSourcingPeople", "b", true, ["p1"]])).toBe(false);
    expect(isPersistableQueryKey(["staffSourcingInvestment", "b", true])).toBe(false);
    expect(isPersistableQueryKey(["staffSourcingCompanies", "b", true, ["k"]])).toBe(false);
    for (const root of STAFF_FLAG_ROOTS.keys()) {
      expect(SENSITIVE_QUERY_ROOTS.has(root), root).toBe(false);
      expect(PERSISTABLE_QUERY_ROOTS.has(root), root).toBe(false);
    }
  });

  it("the Catalogue page and Done by your team persist", () => {
    for (const root of ["catalogueScripts", "catalogueTactics", "catalogueStrategies", "pipeQueue"]) {
      expect(isPersistableQueryKey([root]), root).toBe(true);
    }
  });

  it("no customer v2 file reads a never-persisted root outside the stated exceptions", () => {
    const offenders: string[] = [];
    for (const file of v2Files) {
      if (isStaffSurface(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      for (const m of src.matchAll(/\[\s*"([A-Za-z-]+)"/g)) {
        const root = m[1];
        if (!SENSITIVE_QUERY_ROOTS.has(root)) continue;
        if (root in NEVER_ON_DISK_ON_CUSTOMER_FILES) continue;
        offenders.push(`${root} (${path.relative(DASH, file)})`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});

describe("a skeleton never waits on a fresh fetch when the saved copy has data", () => {
  // Every `isFetchedAfterMount` paint decision sits beside a data check on the same line: the skeleton shows
  // only while there is NO data (saved or fresh) and the read has not answered since mount.
  it("every isFetchedAfterMount line also checks the data", () => {
    const bare: string[] = [];
    for (const file of v2Files) {
      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.includes("isFetchedAfterMount") || line.trim().startsWith("//") || line.trim().startsWith("*")) return;
        if (/: boolean/.test(line)) return; // a prop type
        const checksData =
          /data|isError|TabRows === 0/.test(line) || /![A-Za-z]+\b(?![.(A-Za-z])/.test(line) || /[A-Za-z]+ !== null/.test(line);
        if (!checksData) bare.push(`${path.relative(DASH, file)}:${i + 1}`);
      });
    }
    expect(bare).toEqual([]);
  });
});

describe("the brand's money read starts with the campaigns read, not after it", () => {
  const data = fs.readFileSync(path.join(DASH, "src/components/v2/data.ts"), "utf8");
  it("asks unless the campaigns answered none", () => {
    expect(data).toContain("(campaignIds === null || campaignIds.length > 0)");
    expect(data).not.toContain("(campaignIds?.length ?? 0) > 0");
    // The money summary (MON-PAGE-SPEED-1111), the company pages and one company (MON-PAGE-SPEED-2-1112), the revenue window.
    expect(data.match(/revenueReadEnabled\(featureSlug, brandId, campaignIds\)/g)?.length).toBe(4);
  });
});
