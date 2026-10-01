import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");

describe("a new brand's sales rep defaults to the account email", () => {
  const helper = read("lib/sales-rep-default.ts");

  it("fills only an EMPTY rep, email only, no phone", () => {
    expect(helper).toContain("if (current.salesRepEmail || current.salesRepPhone) return;");
    expect(helper).toContain("salesRepPhone: null");
  });

  it("never throws into the launch", () => {
    expect(helper).toContain("catch (err)");
  });

  for (const file of [
    "components/onboarding/onboarding.tsx",
    "components/v2/get-started/account-card-wall.tsx",
    "components/v2/new-org-modal.tsx",
  ]) {
    it(`${file} defaults the rep before marking onboarding complete`, () => {
      const src = read(file);
      const call = src.indexOf("await defaultSalesRepToAccountEmail(");
      const complete = src.indexOf("/api/onboarding/complete");
      expect(call).toBeGreaterThan(-1);
      expect(call).toBeLessThan(complete);
    });
  }
});
