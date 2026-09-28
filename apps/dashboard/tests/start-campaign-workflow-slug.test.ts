import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// campaign-service's POST /campaigns requires `workflowSlug` and has no dynasty
// field, so the Start on Offer Settings must send the workflow under that name.
// A body carrying only `workflowDynastySlug` was refused 400 on every Start.
const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");

describe("startCampaign sends the workflow campaign-service reads", () => {
  const at = API.indexOf("export async function startCampaign(");
  const body = API.slice(at, API.indexOf("// Campaign sub-resources", at));

  it("sends workflowSlug", () => {
    expect(body).toContain("workflowSlug: params.workflowDynastySlug");
  });

  it("does not send the dynasty field campaign-service ignores", () => {
    expect(body).not.toContain("workflowDynastySlug: params.workflowDynastySlug");
  });
});
