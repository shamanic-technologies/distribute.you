import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");

// Same discipline as use-stop-campaign — mutations that return the fresh entity
// MUST write to the single-entity cache directly. invalidateQueries alone leaves
// the cache stale when the next refetch happens to fail (placeholderData /
// keepPreviousData holds the pre-mutation row). For manual qualifications, the
// "single-entity" cache is the brand-keyed list query, and the side-effect
// list (`["brandLeads", brandId]`) gets invalidated because silver promotion
// can shift counters.
describe("useSetManualQualification — cache write (regression)", () => {
  const src = readFileSync(
    resolve(ROOT, "src/lib/use-manual-qualification.ts"),
    "utf8",
  );

  it("onSuccess writes the fresh qualification into the brand-keyed list cache", () => {
    expect(src).toMatch(
      /setQueryData[<\w\s>]*\(\s*key\s*,/,
    );
    expect(src).toMatch(/manualQualificationsQueryKey\(brandId\)/);
  });

  it("onSuccess invalidates the [\"brandLeads\", brandId] cache so counters refetch", () => {
    expect(src).toMatch(
      /invalidateQueries\(\s*\{\s*queryKey:\s*\[\s*["']brandLeads["']\s*,\s*brandId\s*\]\s*\}\s*\)/,
    );
  });

  it("mutationFn does not swallow errors via try/catch or ?? fallback", () => {
    // Fail-loud: the modal layer surfaces errors via onError. Hook itself must
    // not swallow.
    expect(src).not.toMatch(/catch\s*\(\s*\w+\s*\)\s*\{\s*\}/);
    expect(src).not.toMatch(/\?\?\s*null\s*;/);
  });
});
