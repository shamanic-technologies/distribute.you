import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The Strategy page and the Audiences table render the SAME cross-org fleet
 * benchmark: at 0 outcomes a per-audience cost floors at
 * `max(audience own spend, best-workflow fleet cost)`, and that fleet cost is
 * exactly what `workflow-projection` serves. So the two readers MUST agree on
 * the pricing basis, or the identical benchmark renders at two different prices
 * (net is ~9% under gross once other orgs' usage discounts are frozen into the
 * fleet spend) — an internally-incoherent surface.
 *
 * `fetchFeatureAudienceStats` has always sent `pricing=net`; the org pays net,
 * and the brand-overview cost cards are net. `getWorkflowProjectionLadder` sent
 * no pricing param at all, so features-service defaulted it to gross. Both now
 * send net.
 *
 * Source-substring guards: `api.ts` pulls Clerk + the proxy so it can't be
 * imported under vitest (no `@` alias resolution in this repo).
 */

const apiSrc = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

/** Body of one exported reader, sliced to the next top-level `export` so a
 *  neighbouring reader's params can never satisfy the assertion. */
function readerBody(name: string): string {
  const start = apiSrc.indexOf(`export async function ${name}`);
  expect(start, `${name} not found in api.ts`).toBeGreaterThan(-1);
  const rest = apiSrc.slice(start + 1);
  const next = rest.indexOf("\nexport ");
  return next === -1 ? rest : rest.slice(0, next);
}

describe("workflow-projection / audience-stats pricing basis", () => {
  it("getWorkflowProjectionLadder requests net pricing", () => {
    expect(readerBody("getWorkflowProjectionLadder")).toContain('query.set("pricing", "net")');
  });

  it("fetchFeatureAudienceStats requests net pricing", () => {
    expect(readerBody("fetchFeatureAudienceStats")).toContain('query.set("pricing", "net")');
  });

  it("sends pricing unconditionally on the projection ladder, never behind an optional param", () => {
    const body = readerBody("getWorkflowProjectionLadder");
    // Every other param on this reader is optional (`if (params.x) query.set(...)`).
    // Pricing is not a caller choice — a caller-tunable basis is what let the two
    // surfaces drift apart in the first place.
    expect(body).not.toMatch(/if \(params\.pricing\)/);
    expect(body).not.toContain("params.pricing");
  });
});

/**
 * The whole Overview reads ONE pricing basis. The forecast is the case that made
 * the rule visible: its expected-outreach bar is `daily budget / cost per outreach`,
 * and the budget is money the org really spends — already discounted. Divide that by
 * a gross divisor and a 50%-off brand is promised half the sends its budget buys
 * (prod read 15.88 expected beside 30 actual, the ratio being exactly that org's
 * net/gross). Counts and rates are identical either way; only money-derived values
 * move, so every reader feeding a money-derived number asks for net.
 */
describe("every Overview money reader asks for net pricing", () => {
  for (const reader of [
    "getFeatureRevenue",
    "fetchFeatureAudienceStats",
    "getWorkflowProjectionLadder",
    "getFeaturePipelineActivity",
  ]) {
    it(`${reader} requests net pricing`, () => {
      expect(readerBody(reader)).toContain('query.set("pricing", "net")');
    });
  }
});

/**
 * The rule is not "every reader in api.ts" — it is every reader of a money
 * endpoint, wherever it lives. The outcome digest builds its own URL server-side
 * (it runs on the cron, with admin identity, so it never touches the browser api
 * client), which is exactly why it stayed on the gross default for months while
 * the four readers above were swept to net. A brand on a usage discount then got
 * one return in its inbox and a different one on its Overview, at the same
 * moment, both labelled the same word.
 *
 * `outcome-digest.ts` imports through the `@` alias, so this is a source
 * substring guard like the ones above, scoped to the one function.
 */
const digestSrc = fs.readFileSync(path.join(__dirname, "../src/lib/outcome-digest.ts"), "utf-8");

describe("the outcome digest reads the same net basis as the Overview", () => {
  const start = digestSrc.indexOf("async function fetchBrandRevenue");
  const body = digestSrc.slice(start, digestSrc.indexOf("\nasync function", start + 1));

  it("fetchBrandRevenue requests net pricing", () => {
    expect(start, "fetchBrandRevenue not found in outcome-digest.ts").toBeGreaterThan(-1);
    expect(body).toContain('pricing: "net"');
  });

  it("sends pricing unconditionally, never behind a caller flag", () => {
    // A caller-tunable basis is what let two surfaces drift apart in the first
    // place. The digest reports the brand's return; there is one right answer.
    expect(body).not.toMatch(/if \(.*pricing/);
  });
});
