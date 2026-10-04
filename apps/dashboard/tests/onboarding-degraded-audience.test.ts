import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * apollo-service grades every filter set it builds. When its refine loop judges no
 * candidate a good fit it returns the best attempt anyway, flagged `degraded`, so a
 * customer sees something they can judge and reject instead of an error screen. That
 * flag travels apollo-service -> human-service -> the api-service passthrough and
 * reaches the browser on each `/suggest` candidate.
 *
 * Nothing rendered it, so an audience the builder disowned on both axes looked
 * identical to one it was satisfied with. A production run reached 161 people where
 * the same request had reached 2,640 an hour earlier, and the card said nothing.
 *
 * Three invariants, and the second is the one that matters most: it is INFORMATION,
 * never a gate. A degraded audience is served, persisted and activatable exactly like
 * any other, and the customer decides. Nothing here hides, disables, filters or
 * de-prioritises it, and nothing INFERS degradation from counts or filter shapes —
 * the flag the backend sends is rendered, and nothing more.
 *
 * Source-substring guards on the wire reader (`api.ts` imports through the `@`
 * alias, which vitest does not resolve here).
 */

const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

describe("degraded is read off the wire, optional", () => {
  it("declares degraded on the candidate type", () => {
    expect(API).toContain("degraded?: boolean;");
  });

  it("parses it as OPTIONAL — an older human-service deploy does not send it, and absent means not degraded", () => {
    expect(API).toContain("degraded: z.boolean().optional(),");
  });
});
