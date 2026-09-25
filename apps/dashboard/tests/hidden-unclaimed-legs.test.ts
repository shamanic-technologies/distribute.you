import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A funnel leg no channel of ours performs is HIDDEN from every customer surface
 * (owner-decided 2026-09-25). Those legs used to render as rows reading `Done by you`,
 * then `<Brand> team` / `Distribute.you team`, and opened a page of their own. Nobody
 * clicked them and nobody understood them. Stating that a lead crossed a step happens
 * from the lead panel, which is untouched.
 */
const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("legs no channel of ours performs are hidden", () => {
  it("has no leg page route any more", () => {
    const funnelRoute = join(
      SRC,
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/offers/[offerId]/funnels/[funnelKey]",
    );
    expect(existsSync(join(funnelRoute, "legs"))).toBe(false);
    for (const gone of [
      "components/funnels/funnel-leg-page.tsx",
      "components/funnels/funnel-leg-board.tsx",
      "lib/funnel-leg-board.ts",
      "lib/funnel-leg-operator.ts",
    ]) {
      expect(existsSync(join(SRC, gone)), gone).toBe(false);
    }
  });

  it("renders no operator label for an unclaimed leg anywhere in src", () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => {
        const src = readFileSync(f, "utf8");
        return (
          src.includes("funnelLegOperator") ||
          src.includes("Distribute.you team") ||
          src.includes("Done by you") ||
          src.includes("statesOperator")
        );
      });
    expect(offenders).toEqual([]);
  });

  it("links to no leg route", () => {
    const offenders = walk(SRC)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .filter((f) => readFileSync(f, "utf8").includes("/legs/"));
    expect(offenders).toEqual([]);
  });
});
