import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";

/**
 * The staff console carries its OWN copy of the funnel chains, because it has no
 * `sales-funnels.ts` catalogue of its own (it is a deliberate fork and keeps its own
 * settings surfaces). This guard is the thing that stops the copy drifting.
 *
 * It lives HERE rather than in `apps/admin` on purpose: this suite is a CI merge gate
 * and admin's is not, so a drift caught here blocks a merge instead of rotting silently
 * the way admin's source-substring guards have before.
 *
 * Read as source text rather than imported — admin is a separate app with its own
 * tsconfig, and reaching across with a runtime import would couple the two builds. The
 * chains are plain data, so parsing the literal is enough to compare them.
 */
const ADMIN_CHAINS = readFileSync(
  join(__dirname, "../../admin/src/lib/lead-funnel-stages.ts"),
  "utf8",
);

/** Pull `FUNNEL_CHAINS`'s per-funnel `steps` arrays straight out of the source. */
function adminChains(): Record<string, string[]> {
  const block = ADMIN_CHAINS.slice(
    ADMIN_CHAINS.indexOf("export const FUNNEL_CHAINS"),
    ADMIN_CHAINS.indexOf("export function normalizeSalesFunnelKey"),
  );
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/(\w+):\s*\{\s*name:\s*"[^"]*",\s*steps:\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((s) => s[1]);
  }
  return out;
}

describe("admin's funnel chains match this app's catalogue", () => {
  it("parses admin's chains at all (the guard is worthless if it silently finds none)", () => {
    const chains = adminChains();
    expect(Object.keys(chains).length).toBe(SALES_FUNNELS.length);
  });

  it("carries the same steps, funnel for funnel and label for label", () => {
    // `SALES_FUNNELS` is the single source. Admin's literal copy exists because it has
    // no catalogue; it must say exactly the same thing.
    const chains = adminChains();
    for (const def of SALES_FUNNELS) {
      expect(chains[def.key]).toEqual(def.steps);
    }
  });

  it("carries the same funnel NAMES too, so one funnel reads one way in both consoles", () => {
    for (const def of SALES_FUNNELS) {
      expect(ADMIN_CHAINS).toContain(`name: "${def.name}"`);
    }
  });

  it("covers every funnel this app sells, with no extras", () => {
    expect(Object.keys(adminChains()).sort()).toEqual(SALES_FUNNELS.map((d) => d.key).sort());
  });
});
