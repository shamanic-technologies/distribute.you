import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The "I have no website" path: a brand with no site the user describes in a
 * free-form block instead of a URL. The v1 wizard that first carried it is
 * deleted; the v2 new-org modal is the live caller of the same API helper.
 *
 * Behavioural import isn't possible (Clerk/posthog/api pulls through the `@`
 * alias), so we assert the load-bearing source.
 */
const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

describe("no-website brand creation", () => {
  it("isolates the create+context API calls behind one helper conformed to the deployed contract", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain("export async function createBrandWithoutWebsite");
    // Conformed to brand-service #366: POST /brands { name } then
    // PUT /brands/:id/business-context { content } before extraction.
    expect(api).toContain("/business-context");
    expect(api).toContain("body: { content: context }");
  });

  it("the v2 new-org modal calls it (a helper nothing calls is the feature absent)", () => {
    const modal = read("src/components/v2/new-org-modal.tsx");
    expect(modal).toContain("await createBrandWithoutWebsite(");
  });
});
