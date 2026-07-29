import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const card = readFileSync(resolve(ROOT, "src/components/settings/brand-domain-card.tsx"), "utf8");

// A real customer adding their website saw this rendered on screen, verbatim:
//   Could not save: {"error":"A brand already exists for domain \"…\"","code":"DOMAIN_CONFLICT"}
// api-service flattens the downstream error body into `message`, so printing the
// message put a JSON blob in front of them. The card renders the REASON (from the
// HTTP status), never the raw text.
describe("Brand Domain card error handling", () => {
  it("never renders the raw backend error text", () => {
    expect(card).not.toContain("error.message");
    expect(card).not.toContain("error instanceof Error ? error.message");
  });

  it("branches on the 409 conflict status rather than a message substring", () => {
    expect(card).toContain("error instanceof ApiError && error.status === 409");
  });

  it("names the brand already holding the domain, when this org owns it", () => {
    expect(card).toContain("conflictingBrand");
    expect(card).toContain('useAuthQuery(["brands"]');
    expect(card).toContain("is already attached to your brand");
  });

  it("falls back to a human message when the holder is not one of our brands", () => {
    expect(card).toContain("is already in use by another account");
    expect(card).toContain("We could not save your website");
  });

  it("still fails loud in the console", () => {
    expect(card).toContain("console.error");
    expect(card).toContain("attachBrandWebsite failed");
  });

  it("compares domains without the www prefix, like brand-service does", () => {
    expect(card).toContain("bareHost");
    expect(card).toContain("replace(/^www\\./, \"\")");
  });
});
