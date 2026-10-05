import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The "I have no website" path: a brand with no site the user describes in a
 * free-form block instead of a URL. The v1 wizard that first carried it is
 * deleted; the brand walk run from the dashboard (Add a brand, "This brand has no
 * website") is the live caller of the same API helper.
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

  it("the dashboard's brand walk calls it (a helper nothing calls is the feature absent)", () => {
    const walk = read("src/components/v2/get-started/get-started.tsx");
    expect(walk).toContain("await createBrandWithoutWebsite(");
    expect(walk).toContain("onWithoutWebsite={org ? (name, text) => void startWithoutWebsite(name, text) : null}");
  });
});
