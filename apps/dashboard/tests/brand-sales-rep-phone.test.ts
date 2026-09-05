import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const CARD = readFileSync(
  "src/components/settings/brand-sales-rep-phone-card.tsx",
  "utf8",
);
const PAGE = readFileSync(
  "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  "utf8",
);
const API = readFileSync("src/lib/api.ts", "utf8");

/**
 * A `not.toContain` guard reads the file its own explanation lives in, so a comment
 * that NAMES the forbidden literal fails the guard for the code that obeys it. Both
 * assertions below tripped on this card's own doc comment before it was stripped —
 * reword-the-comment is the other fix and it degrades the explanation, so strip.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const CARD_CODE = stripComments(CARD);
const PERSIST = readFileSync("src/lib/persist-cache.ts", "utf8");

/** The function body, bounded by the next top-level declaration rather than a measured length. */
function sliceToNextExport(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  const next = src.indexOf("\nexport ", at + marker.length);
  return src.slice(at, next === -1 ? undefined : next);
}

describe("the brand states one number to ring", () => {
  it("is mounted on brand Settings, not on a campaign or offer surface", () => {
    expect(PAGE).toContain("<BrandSalesRepPhoneCard brandId={brandId} />");
  });

  it("reads and writes through the gateway's own path", () => {
    expect(API).toContain("`/brands/${brandId}/sales-rep-phone`");
  });

  it("clears by asking the producer to remove it, never by writing an empty string", () => {
    const body = sliceToNextExport(CARD, "const save = useMutation(");
    expect(body).toContain("clearBrandSalesRepPhone(brandId)");
    expect(body).not.toContain('setBrandSalesRepPhone(brandId, "")');
  });

  it("writes the response into the cache instead of re-reading it", () => {
    const body = sliceToNextExport(CARD, "const save = useMutation(");
    expect(body).toContain('queryClient.setQueryData(["brandSalesRepPhone", brandId], next)');
    expect(body).not.toContain("invalidateQueries");
  });

  it("re-seeds from a fresher payload rather than latching once per mount", () => {
    // The first payload to settle is the on-disk one, so a boolean hydrated latch
    // would seed from the previous visit and ignore the server's answer.
    expect(CARD).toContain("seededFrom");
    expect(CARD).not.toContain("if (hydrated.current) return");
  });

  it("arms Save on a live compare, never a sticky edited flag", () => {
    expect(CARD).toContain('const dirty = value.trim() !== (saved ?? "");');
  });

  it("renders the producer's own refusal and never err.message", () => {
    const body = sliceToNextExport(CARD, "function saveErrorMessage(");
    expect(body).toContain("body?.error");
    expect(CARD_CODE).not.toContain("err.message");
    expect(CARD_CODE).not.toContain("error.message");
  });

  it("does not re-implement what a valid number is — brand-service owns that", () => {
    // A second copy of the rule is how the two come to disagree, and the
    // disagreement is a call placed to the wrong human.
    expect(CARD_CODE).not.toMatch(/E\.164|\\d\{8,15\}|replace\(\/\\D/);
  });

  it("says nobody is rung rather than showing an unexplained empty field", () => {
    expect(CARD).toContain("No number set, so nobody is rung when a reply lands.");
  });

  it("persists its query root, so the field paints from disk instead of cold-loading", () => {
    expect(PERSIST).toContain('"brandSalesRepPhone"');
  });
});
