import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
const PAGE = readFileSync(join(__dirname, "../src/components/v2/workflow-page.tsx"), "utf8");

// The workflow page is opened FOR ONE CREW (channel x leg). Its Over time band must ask
// features-service for that leg only, or a reply-led crew shows a visit-led campaign's value.
describe("workflow Over time is scoped to the crew's leg", () => {
  it("both fleet readers send the leg through one query builder", () => {
    expect(API).toContain('if (legKey) query.set("leg", legKey);');
    const readers = API.match(/const query = fleetReturnQuery\(featureSlug, workflowDynastySlug, legKey\);/g) ?? [];
    expect(readers.length).toBe(2);
  });

  it("the page passes the crew's leg and keys both reads on it", () => {
    expect(PAGE).toContain("<OverTime featureSlug={spec.featureSlug} legKey={spec.legKey} dynasty={dynasty} />");
    expect(PAGE).toContain('["fleetWorkflowReturn", featureSlug, dynasty, legKey]');
    expect(PAGE).toContain("getFleetWorkflowReturnHistory(featureSlug, dynasty, legKey)");
    expect(PAGE).toContain('["fleetWorkflowActualCost", featureSlug, dynasty, legKey]');
    expect(PAGE).toContain("getFleetWorkflowActualCostHistory(featureSlug, dynasty, legKey)");
  });

  it("the heading no longer claims every client on every leg", () => {
    expect(PAGE).not.toContain("all clients combined");
  });
});
