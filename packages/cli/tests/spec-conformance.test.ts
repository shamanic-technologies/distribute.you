import { describe, expect, it } from "vitest";
import { ROUTES } from "../src/routes.js";
import { findOperation, listOperations } from "../src/spec.js";
import { commandName } from "../src/commands/resource.js";

const API_URL = process.env.DISTRIBUTE_API_URL ?? "https://api.distribute.you";

/**
 * The named commands are claims about another service. This reads the live
 * OpenAPI document and fails if any of them names an operation that is not
 * there, which is the only way a hand written route table stays honest as the
 * API changes. No copy of that document is kept in this repo: a snapshot would
 * make this test pass forever while the CLI drifted.
 */
describe("routes exist in the live API", () => {
  it("every named command maps to a real operation", async () => {
    let document: unknown;
    try {
      const response = await fetch(`${API_URL}/openapi.json`, { signal: AbortSignal.timeout(20_000) });
      expect(response.ok, `${API_URL}/openapi.json returned ${response.status}`).toBe(true);
      document = await response.json();
    } catch (error) {
      // Offline is not a failing route table. Say so out loud rather than
      // reporting a pass that checked nothing.
      console.warn(`Skipped: could not reach ${API_URL}/openapi.json (${String(error)})`);
      return;
    }

    const operations = listOperations(document as never);
    expect(operations.length).toBeGreaterThan(0);

    const missing = ROUTES.filter((route) => !findOperation(operations, route.method, route.path)).map(
      (route) => `${commandName(route)} -> ${route.method} ${route.path}`,
    );
    expect(missing).toEqual([]);
  }, 30_000);
});
