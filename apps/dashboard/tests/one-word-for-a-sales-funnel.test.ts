/**
 * A sales funnel has ONE name in this product, and it is "sales funnel".
 *
 * For a while the same grain was also called something else, and the second word
 * outlived the rename in comments, identifiers, CSS classes and test titles across
 * all three apps. A second word for one concept is how two surfaces come to describe
 * the same thing differently, so this guard keeps it from coming back.
 *
 * The word is built rather than written, so the guard does not fail on itself.
 *
 * WHAT IS ALLOWED, and only this: a key another service PUTS ON THE WIRE. A key is
 * whatever the producer sends it as, so renaming one here would simply stop reading
 * the field. lead-service's `/orgs/leads/{id}/step-statements` serves the funnel's
 * steps under that older word; every value this app derives from it is called a
 * funnel. Tracked as a lead-service rename request — the day it serves the new name,
 * read that and shrink this list.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const BANNED = ["ch", "ain"].join("");
const REPO = join(__dirname, "..", "..", "..");

/** Files allowed to carry it, and why. Path is relative to the repo root. */
const PRODUCER_OWNED = new Set([
  // lead-service wire keys (`chain`, `inChain`, `chainIndex`) and the comments naming them.
  "apps/dashboard/src/lib/api.ts",
  "apps/admin/src/lib/api.ts",
  "apps/dashboard/src/lib/use-lead-step-statements.ts",
  "apps/admin/src/lib/use-lead-step-statements.ts",
  "apps/dashboard/tests/lead-funnel-stage-panel.test.ts",
  "apps/admin/tests/lead-funnel-stage-panel.test.ts",
  // A blockchain, in a platform prompt. The precise word for the thing it names.
  "apps/dashboard/src/instrumentation.ts",
  // This guard names what it forbids.
  "apps/dashboard/tests/one-word-for-a-sales-funnel.test.ts",
  // ...and the page guard that asserts the same absence on its own surface.
  "apps/dashboard/tests/offer-funnels.test.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|html|css)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("one word for a sales funnel, across the three apps", () => {
  it("uses no second word for it anywhere but a producer's own wire key", () => {
    const offenders: string[] = [];
    for (const app of ["dashboard", "admin", "landing"]) {
      for (const sub of ["src", "tests", "public", "scripts"]) {
        let files: string[];
        try {
          files = walk(join(REPO, "apps", app, sub));
        } catch {
          continue; // an app without that directory
        }
        for (const file of files) {
          const rel = file.slice(REPO.length + 1);
          if (PRODUCER_OWNED.has(rel)) continue;
          if (readFileSync(file, "utf8").toLowerCase().includes(BANNED)) offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
